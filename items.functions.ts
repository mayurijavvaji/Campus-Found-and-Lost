// Server functions for CampusFind. Everything here runs on the server only,
// so private fields (emails, token hashes, messages) never reach the browser
// unless the correct management token is supplied.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CATEGORIES,
  LOCATIONS,
  PAGE_SIZE,
  MAX_IMAGE_BYTES,
  IMAGE_TYPES,
  checkEventDate,
  type PublicItem,
  type ItemMessage,
} from "./constants";

const BUCKET = "item-photos";
const PUBLIC_COLS =
  "id, report_type, title, category, location, location_detail, event_date, description, image_url, status, resolved_at, reporter_name, is_sample, created_at";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Row = {
  id: string;
  report_type: string;
  title: string;
  category: string;
  location: string;
  location_detail: string | null;
  event_date: string;
  description: string;
  image_url: string | null;
  status: string;
  resolved_at: string | null;
  reporter_name: string;
  is_sample: boolean;
  created_at: string;
};

async function toPublic(rows: Row[]): Promise<PublicItem[]> {
  const db = await admin();
  const paths = rows.map((r) => r.image_url).filter((p): p is string => !!p);
  const urlMap = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    data?.forEach((d) => d.path && d.signedUrl && urlMap.set(d.path, d.signedUrl));
  }
  return rows.map((r) => ({
    id: r.id,
    reportType: r.report_type as "lost" | "found",
    title: r.title,
    category: r.category,
    location: r.location,
    locationDetail: r.location_detail,
    eventDate: r.event_date,
    description: r.description,
    imageUrl: r.image_url ? (urlMap.get(r.image_url) ?? null) : null,
    status: r.status as "open" | "resolved",
    resolvedAt: r.resolved_at,
    reporterName: r.reporter_name,
    isSample: r.is_sample,
    createdAt: r.created_at,
  }));
}

const uuid = z.string().uuid("Invalid item id");

// ---------- Stats ----------
export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [all, resolved] = await Promise.all([
    db.from("items").select("id", { count: "exact", head: true }),
    db.from("items").select("id", { count: "exact", head: true }).eq("status", "resolved"),
  ]);
  const total = all.count ?? 0;
  const res = resolved.count ?? 0;
  return { total, resolved: res, open: total - res };
});

// ---------- List ----------
const listSchema = z.object({
  q: z.string().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  location: z.enum(LOCATIONS).optional(),
  type: z.enum(["lost", "found"]).optional(),
  status: z.enum(["open", "resolved", "all"]).optional(),
  page: z.number().int().min(1).max(1000).optional(),
});
export type ListFilters = z.infer<typeof listSchema>;

export const listItems = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const page = data.page ?? 1;
    const from = (page - 1) * PAGE_SIZE;
    let query = db
      .from("items")
      .select(PUBLIC_COLS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    const status = data.status ?? "open";
    if (status !== "all") query = query.eq("status", status);
    if (data.category) query = query.eq("category", data.category);
    if (data.location) query = query.eq("location", data.location);
    if (data.type) query = query.eq("report_type", data.type);

    // Safe, case-insensitive keyword search: strip filter syntax chars, escape wildcards.
    const q = (data.q ?? "").replace(/[",()\\]/g, " ").trim();
    if (q) {
      const esc = q.replace(/[%_]/g, (m) => "\\" + m);
      query = query.or(`title.ilike."%${esc}%",description.ilike."%${esc}%"`);
    }

    const { data: rows, count, error } = await query;
    if (error) {
      console.error("listItems failed", error.message);
      throw new Error("Could not load reports right now.");
    }
    return {
      items: await toPublic((rows ?? []) as Row[]),
      total: count ?? 0,
      page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    };
  });

// ---------- Detail ----------
export const getItem = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("items").select(PUBLIC_COLS).eq("id", data.id).maybeSingle();
    if (!row) return null;
    return (await toPublic([row as Row]))[0];
  });

// ---------- Create ----------
const createSchema = z.object({
  reportType: z.enum(["lost", "found"]),
  title: z.string().trim().min(3, "Item name must be at least 3 characters.").max(80),
  category: z.enum(CATEGORIES),
  location: z.enum(LOCATIONS),
  locationDetail: z.string().trim().max(120).optional(),
  eventDate: z.string().refine((v) => checkEventDate(v) === null, "Invalid date."),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters.")
    .max(1000, "Description must be under 1000 characters."),
  reporterName: z.string().trim().min(2).max(60),
  contactEmail: z.string().trim().toLowerCase().email().max(120),
  image: z
    .object({
      type: z.enum(IMAGE_TYPES),
      base64: z.string().max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16),
    })
    .optional(),
});
export type CreateInput = z.infer<typeof createSchema>;

export const createItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    let imagePath: string | null = null;

    if (data.image) {
      const bin = Uint8Array.from(atob(data.image.base64), (c) => c.charCodeAt(0));
      if (bin.byteLength > MAX_IMAGE_BYTES) throw new Error("Photo must be 5 MB or smaller.");
      const ext = (data.image.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
      imagePath = `${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage
        .from(BUCKET)
        .upload(imagePath, bin, { contentType: data.image.type });
      if (error) {
        console.error("upload failed", error.message);
        throw new Error("Photo upload failed. Please try another image.");
      }
    }

    const token = newToken();
    const { data: row, error } = await db
      .from("items")
      .insert({
        report_type: data.reportType,
        title: data.title,
        category: data.category,
        location: data.location,
        location_detail: data.locationDetail || null,
        event_date: data.eventDate,
        description: data.description,
        image_url: imagePath,
        reporter_name: data.reporterName,
        contact_email: data.contactEmail,
        manage_token_hash: await sha256(token),
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("insert failed", error?.message);
      throw new Error("Could not save your report. Please try again.");
    }
    // The raw token is returned exactly once, here.
    return { id: row.id, token };
  });

// ---------- Messages ----------
export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: uuid,
        senderName: z.string().trim().min(2, "Name is too short.").max(60),
        senderContact: z.string().trim().min(5, "Enter an email or phone number.").max(120),
        body: z.string().trim().min(5, "Message is too short.").max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: item } = await db.from("items").select("status").eq("id", data.itemId).maybeSingle();
    if (!item) throw new Error("This report no longer exists.");
    if (item.status === "resolved") throw new Error("This report is already resolved.");
    const { error } = await db.from("messages").insert({
      item_id: data.itemId,
      sender_name: data.senderName,
      sender_contact: data.senderContact,
      body: data.body,
    });
    if (error) throw new Error("Could not send your message.");
    return { ok: true };
  });

// ---------- Manage (token required) ----------
const manageSchema = z.object({ id: uuid, token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid link") });

async function verify(id: string, token: string) {
  const db = await admin();
  const { data } = await db.from("items").select("manage_token_hash").eq("id", id).maybeSingle();
  if (!data) return false;
  const h = await sha256(token);
  // constant-ish comparison
  let diff = h.length ^ data.manage_token_hash.length;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ (data.manage_token_hash.charCodeAt(i) || 0);
  return diff === 0;
}

export const getManaged = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => manageSchema.parse(d))
  .handler(async ({ data }) => {
    if (!(await verify(data.id, data.token))) return { ok: false as const };
    const db = await admin();
    const [{ data: row }, { data: msgs }] = await Promise.all([
      db.from("items").select(PUBLIC_COLS + ", contact_email").eq("id", data.id).single(),
      db.from("messages").select("*").eq("item_id", data.id).order("created_at", { ascending: false }),
    ]);
    const item = (await toPublic([row as unknown as Row]))[0]!;
    const messages: ItemMessage[] = (msgs ?? []).map((m) => ({
      id: m.id,
      senderName: m.sender_name,
      senderContact: m.sender_contact,
      body: m.body,
      createdAt: m.created_at,
    }));
    return {
      ok: true as const,
      item,
      contactEmail: (row as unknown as { contact_email: string }).contact_email,
      messages,
    };
  });

export const resolveItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => manageSchema.parse(d))
  .handler(async ({ data }) => {
    if (!(await verify(data.id, data.token))) throw new Error("This management link is not valid.");
    const db = await admin();
    const { error } = await db
      .from("items")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "open");
    if (error) throw new Error("Could not update the report.");
    return { ok: true };
  });

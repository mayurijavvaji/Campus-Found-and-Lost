import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createItem, type CreateInput } from "@/lib/items.functions";
import { CATEGORIES, LOCATIONS, IMAGE_TYPES, MAX_IMAGE_BYTES, checkEventDate } from "@/lib/constants";
import { Field, inputCls } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report an Item — CampusFind" },
      { name: "description", content: "Report a lost or found item on campus in under a minute." },
      { property: "og:title", content: "Report an Item — CampusFind" },
      { property: "og:description", content: "Post a lost or found item so your campus can help." },
    ],
  }),
  component: ReportPage,
});

type Form = {
  reportType: "lost" | "found";
  title: string;
  category: string;
  location: string;
  locationDetail: string;
  eventDate: string;
  description: string;
  reporterName: string;
  contactEmail: string;
};
const empty: Form = { reportType: "lost", title: "", category: "", location: "", locationDetail: "", eventDate: "", description: "", reporterName: "", contactEmail: "" };

function validate(f: Form) {
  const e: Partial<Record<keyof Form | "image", string | undefined>> = {};
  const t = (s: string) => s.trim();
  if (t(f.title).length < 3) e.title = "Item name must be at least 3 characters.";
  else if (t(f.title).length > 80) e.title = "Keep the item name under 80 characters.";
  if (!f.category) e.category = "Choose a category.";
  if (!f.location) e.location = "Choose a campus location.";
  if (t(f.locationDetail).length > 120) e.locationDetail = "Keep this under 120 characters.";
  if (!f.eventDate) e.eventDate = "Pick the date.";
  else { const d = checkEventDate(f.eventDate); if (d) e.eventDate = d; }
  const dl = t(f.description).length;
  if (dl < 20) e.description = `Add a bit more detail (${dl}/20 characters minimum).`;
  else if (dl > 1000) e.description = "Description must be under 1000 characters.";
  if (t(f.reporterName).length < 2) e.reporterName = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t(f.contactEmail))) e.contactEmail = "Enter a valid email address.";
  return e;
}

function readBase64(file: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function ReportPage() {
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; token: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const pickFile = (fl: File | undefined) => {
    setErrors((p) => ({ ...p, image: undefined }));
    if (!fl) return;
    if (!(IMAGE_TYPES as readonly string[]).includes(fl.type)) return setErrors((p) => ({ ...p, image: "Use a JPEG, PNG, or WebP image." }));
    if (fl.size > MAX_IMAGE_BYTES) return setErrors((p) => ({ ...p, image: "Photo must be 5 MB or smaller." }));
    setFile(fl);
    setPreview(URL.createObjectURL(fl));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs = validate(f);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) { toast.error("Please fix the highlighted fields."); return; }
    setBusy(true);
    try {
      const payload: CreateInput = {
        reportType: f.reportType,
        title: f.title.trim(),
        category: f.category as CreateInput["category"],
        location: f.location as CreateInput["location"],
        locationDetail: f.locationDetail.trim() || undefined,
        eventDate: f.eventDate,
        description: f.description.trim(),
        reporterName: f.reporterName.trim(),
        contactEmail: f.contactEmail.trim(),
        image: file ? { type: file.type as (typeof IMAGE_TYPES)[number], base64: await readBase64(file) } : undefined,
      };
      const res = await createItem({ data: payload });
      setDone(res);
      qc.invalidateQueries();
      toast.success("Report published!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Success {...done} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold">Report an item</h1>
      <p className="mt-2 text-muted-foreground">Your email stays private. Only the reporter can see messages.</p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6 rounded-3xl border bg-card p-6 shadow-card md:p-8">
        <div className="grid grid-cols-2 gap-3">
          {(["lost", "found"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setF((p) => ({ ...p, reportType: t }))}
              className={cn(
                "rounded-2xl border-2 p-4 text-left transition",
                f.reportType === t ? (t === "lost" ? "border-lost bg-lost-soft" : "border-found bg-found-soft") : "border-border hover:border-primary/40",
              )}
            >
              <div className={cn("font-display text-lg font-bold", t === "lost" ? "text-lost" : "text-found")}>
                {t === "lost" ? "I lost something" : "I found something"}
              </div>
              <div className="text-xs text-muted-foreground">{t === "lost" ? "Ask campus to keep an eye out" : "Help it get back to its owner"}</div>
            </button>
          ))}
        </div>

        <Field label="Item name" error={errors.title}>
          <input className={inputCls} aria-invalid={!!errors.title} value={f.title} onChange={set("title")} maxLength={80} placeholder="e.g. Black Dell laptop charger" />
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Category" error={errors.category}>
            <select className={inputCls} aria-invalid={!!errors.category} value={f.category} onChange={set("category")}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={f.reportType === "lost" ? "Date lost" : "Date found"} error={errors.eventDate}>
            <input type="date" className={inputCls} aria-invalid={!!errors.eventDate} value={f.eventDate} max={today} onChange={set("eventDate")} />
          </Field>
          <Field label="Campus location" error={errors.location}>
            <select className={inputCls} aria-invalid={!!errors.location} value={f.location} onChange={set("location")}>
              <option value="">Select a location</option>
              {LOCATIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Location details (optional)" error={errors.locationDetail}>
            <input className={inputCls} value={f.locationDetail} onChange={set("locationDetail")} maxLength={120} placeholder="e.g. 2nd floor, near the window" />
          </Field>
        </div>

        <Field label="Description" error={errors.description} hint={`${f.description.trim().length}/1000 · colour, brand, distinguishing marks`}>
          <textarea rows={5} className={inputCls} aria-invalid={!!errors.description} value={f.description} onChange={set("description")} maxLength={1000} />
        </Field>

        <Field label="Photo (optional)" error={errors.image} hint="JPEG, PNG or WebP · up to 5 MB">
          <div className="flex items-center gap-4 rounded-xl border border-dashed p-3">
            <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {preview && <img src={preview} alt="" className="h-full w-full object-cover" />}
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickFile(e.target.files?.[0])} className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:font-semibold file:text-accent-foreground" />
          </div>
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Your display name" error={errors.reporterName}>
            <input className={inputCls} aria-invalid={!!errors.reporterName} value={f.reporterName} onChange={set("reporterName")} maxLength={60} />
          </Field>
          <Field label="Your email (kept private)" error={errors.contactEmail}>
            <input type="email" className={inputCls} aria-invalid={!!errors.contactEmail} value={f.contactEmail} onChange={set("contactEmail")} maxLength={120} />
          </Field>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {busy ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Publishing…</> : "Publish report"}
        </Button>
      </form>
    </div>
  );
}

function Success({ id, token }: { id: string; token: string }) {
  const [link, setLink] = useState("");
  useEffect(() => setLink(`${window.location.origin}/manage/${id}#${token}`), [id, token]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-found-soft text-found animate-in zoom-in">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
      </div>
      <h1 className="mt-5 text-4xl font-extrabold">Your report is live</h1>
      <p className="mt-2 text-muted-foreground">Save your private management link below. It's shown only once.</p>
      <div className="mt-8 rounded-2xl border-2 border-primary/30 bg-primary-soft p-5 text-left">
        <div className="text-xs font-bold uppercase tracking-wider text-primary">Private management link</div>
        <code className="mt-2 block break-all text-sm">{link || "…"}</code>
        <p className="mt-3 text-xs text-muted-foreground">
          Anyone with this link can read your messages and resolve the report. Don't share it publicly.
        </p>
        <Button className="mt-4" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}>Copy link</Button>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="hero"><Link to="/items/$id" params={{ id }}>View report</Link></Button>
        <Button asChild variant="soft"><Link to="/manage/$id" params={{ id }} hash={token}>Open management page</Link></Button>
      </div>
    </div>
  );
}

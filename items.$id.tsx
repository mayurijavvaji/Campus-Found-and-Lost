import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getItem, sendMessage } from "@/lib/items.functions";
import { ItemPhoto, StatusBadge, TypeBadge, formatDate } from "@/components/ItemCard";
import { Field, inputCls } from "@/components/Field";
import { Button } from "@/components/ui/button";

const itemQuery = (id: string) => queryOptions({ queryKey: ["item", id], queryFn: () => getItem({ data: { id } }) });
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export const Route = createFileRoute("/items/$id")({
  loader: async ({ params, context }) => {
    if (!isUuid(params.id)) throw notFound();
    const item = await context.queryClient.ensureQueryData(itemQuery(params.id));
    if (!item) throw notFound();
    return { title: item.title, type: item.reportType, location: item.location };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Report not found — CampusFind" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.type === "lost" ? "Lost" : "Found"}: ${loaderData.title} — CampusFind`;
    const d = `${loaderData.title} ${loaderData.type} near ${loaderData.location}. Can you help?`;
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  notFoundComponent: ItemNotFound,
  component: ItemPage,
});

function ItemNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Report not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Button asChild variant="hero" className="mt-6"><Link to="/">Back to browse</Link></Button>
    </div>
  );
}

function ItemPage() {
  const { id } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(id));
  if (!item) return <ItemNotFound />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← Back to browse</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-3xl border shadow-card">
            <ItemPhoto item={item} />
          </div>
          <div className="mt-6 rounded-3xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={item.reportType} />
              <StatusBadge status={item.status} />
              {item.isSample && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Sample data</span>}
            </div>
            <h1 className="mt-4 text-4xl font-extrabold">{item.title}</h1>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <Info k="Category" v={item.category} />
              <Info k={item.reportType === "lost" ? "Date lost" : "Date found"} v={formatDate(item.eventDate)} />
              <Info k="Location" v={item.location + (item.locationDetail ? ` · ${item.locationDetail}` : "")} />
              <Info k="Reported by" v={item.reporterName} />
            </dl>
            <h2 className="mt-6 text-lg font-bold">Description</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          {item.status === "resolved" ? (
            <div className="rounded-3xl border bg-found-soft p-6 text-center">
              <h2 className="text-2xl font-extrabold text-found">Resolved 🎉</h2>
              <p className="mt-2 text-sm text-muted-foreground">This item has been returned. Messages are closed.</p>
            </div>
          ) : (
            <ContactForm itemId={item.id} name={item.reporterName} />
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 font-semibold">{v}</dd>
    </div>
  );
}

function ContactForm({ itemId, name }: { itemId: string; name: string }) {
  const [f, setF] = useState({ senderName: "", senderContact: "", body: "" });
  const [errors, setErrors] = useState<{ senderName?: string; senderContact?: string; body?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const er: { senderName?: string; senderContact?: string; body?: string } = {};
    if (f.senderName.trim().length < 2) er.senderName = "Enter your name.";
    if (f.senderContact.trim().length < 5) er.senderContact = "Enter an email or phone number.";
    if (f.body.trim().length < 5) er.body = "Write a short message.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await sendMessage({ data: { itemId, ...f } });
      setSent(true);
      toast.success("Message sent privately");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="rounded-3xl border bg-card p-6 text-center shadow-card">
        <h2 className="text-2xl font-extrabold">Message sent</h2>
        <p className="mt-2 text-sm text-muted-foreground">{name} will see it on their private page and reach out to you.</p>
        <Button variant="soft" className="mt-4" onClick={() => { setSent(false); setF({ senderName: "", senderContact: "", body: "" }); }}>Send another</Button>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl border bg-card p-6 shadow-card">
      <div>
        <h2 className="text-2xl font-extrabold">Contact {name}</h2>
        <p className="text-sm text-muted-foreground">Only the reporter can read this message.</p>
      </div>
      <Field label="Your name" error={errors.senderName}>
        <input className={inputCls} aria-invalid={!!errors.senderName} maxLength={60} value={f.senderName} onChange={(e) => setF({ ...f, senderName: e.target.value })} />
      </Field>
      <Field label="Email or phone" error={errors.senderContact}>
        <input className={inputCls} aria-invalid={!!errors.senderContact} maxLength={120} value={f.senderContact} onChange={(e) => setF({ ...f, senderContact: e.target.value })} />
      </Field>
      <Field label="Message" error={errors.body}>
        <textarea rows={4} className={inputCls} aria-invalid={!!errors.body} maxLength={1000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="I think this is mine — it has…" />
      </Field>
      <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>{busy ? "Sending…" : "Send private message"}</Button>
    </form>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getManaged, resolveItem } from "@/lib/items.functions";
import { ItemPhoto, StatusBadge, TypeBadge, formatDate } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/manage/$id")({
  head: () => ({
    meta: [
      { title: "Manage your report — CampusFind" },
      { name: "description", content: "Private page to read messages and resolve your report." },
      { property: "og:title", content: "Manage your report — CampusFind" },
      { property: "og:description", content: "Private report management." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManagePage,
});

type Data = Extract<Awaited<ReturnType<typeof getManaged>>, { ok: true }>;

function ManagePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [state, setState] = useState<"loading" | "invalid" | "error" | "ready">("loading");
  const [data, setData] = useState<Data | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (t: string) => {
    try {
      const res = await getManaged({ data: { id, token: t } });
      if (!res.ok) return setState("invalid");
      setData(res);
      setState("ready");
    } catch {
      setState(/^[a-f0-9]{64}$/.test(t) ? "error" : "invalid");
    }
  }, [id]);

  useEffect(() => {
    // The token lives in the URL #fragment, so it's never sent to servers or logs.
    const t = window.location.hash.slice(1);
    setToken(t);
    load(t);
  }, [load]);

  const resolve = async () => {
    setBusy(true);
    try {
      await resolveItem({ data: { id, token } });
      toast.success("Marked as resolved. Great job!");
      qc.invalidateQueries();
      await load(token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resolve.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading")
    return <div className="mx-auto max-w-4xl px-4 py-24"><div className="h-64 animate-pulse rounded-3xl bg-muted" /></div>;
  if (state !== "ready" || !data)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">{state === "invalid" ? "Invalid management link" : "Something went wrong"}</h1>
        <p className="mt-2 text-muted-foreground">
          {state === "invalid" ? "This link is incorrect or incomplete. Use the exact link you saved when you created the report." : "Please try again in a moment."}
        </p>
        <Button asChild variant="hero" className="mt-6"><Link to="/">Back to browse</Link></Button>
      </div>
    );

  const { item, messages, contactEmail } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm font-medium text-accent-foreground">
        🔒 Private page. Keep this link secret — anyone with it can manage this report.
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl"><ItemPhoto item={item} /></div>
          <div className="mt-4 flex gap-2"><TypeBadge type={item.reportType} /><StatusBadge status={item.status} /></div>
          <h1 className="mt-3 text-2xl font-extrabold">{item.title}</h1>
          <p className="text-sm text-muted-foreground">{item.location} · {formatDate(item.eventDate)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Your email: {contactEmail}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button asChild variant="soft"><Link to="/items/$id" params={{ id }}>View public page</Link></Button>
            {item.status === "open" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="hero" disabled={busy}>Mark as resolved</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark this report as resolved?</AlertDialogTitle>
                    <AlertDialogDescription>It will be hidden from the default listing and nobody can send new messages. This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resolve}>Yes, resolve it</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <p className="rounded-xl bg-found-soft p-3 text-center text-sm font-semibold text-found">Resolved {item.resolvedAt ? formatDate(item.resolvedAt) : ""}</p>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold">Messages <span className="text-muted-foreground">({messages.length})</span></h2>
          {messages.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">No messages yet. Check back soon.</div>
          ) : (
            <ul className="mt-4 space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-bold">{m.senderName}</span>
                    <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="text-sm font-semibold text-primary">{m.senderContact}</div>
                  <p className="mt-2 whitespace-pre-line text-sm">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

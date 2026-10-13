import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getStats, listItems, type ListFilters } from "@/lib/items.functions";
import { CATEGORIES, LOCATIONS } from "@/lib/constants";
import { ItemCard } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  location: z.enum(LOCATIONS).optional().catch(undefined),
  type: z.enum(["lost", "found"]).optional().catch(undefined),
  status: z.enum(["open", "resolved", "all"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});

const statsQuery = queryOptions({ queryKey: ["stats"], queryFn: () => getStats() });
const listQuery = (f: ListFilters) =>
  queryOptions({ queryKey: ["items", f], queryFn: () => listItems({ data: f }) });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "CampusFind — Campus Lost & Found Portal" },
      { name: "description", content: "Report and find lost items on campus. Search, filter, and contact the finder privately." },
      { property: "og:title", content: "CampusFind — Campus Lost & Found Portal" },
      { property: "og:description", content: "Lost something? Let your campus help you find it." },
    ],
  }),
  component: Home,
});

const selectCls =
  "h-11 rounded-xl border border-input bg-card px-3 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const stats = useQuery(statsQuery);
  const list = useQuery({ ...listQuery(search), placeholderData: (p) => p });
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => setQ(search.q ?? ""), [search.q]);

  const update = (patch: Partial<ListFilters>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? undefined }), resetScroll: false });

  const hasFilters = !!(search.q || search.category || search.location || search.type || search.status);

  return (
    <>
      <section className="relative overflow-hidden bg-hero">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.3fr_1fr] md:py-24">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Campus Lost & Found
            </span>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] md:text-6xl">
              Lost something?
              <br />
              <span className="text-gradient">Let your campus help you find it.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Post a lost or found item in under a minute. Browse reports, message the finder privately,
              and mark it resolved once it's back where it belongs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/report">Report an Item</Link>
              </Button>
              <Button asChild variant="soft" size="lg">
                <a href="#browse">Browse reports</a>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 content-center gap-4">
            <Stat label="Total reports" value={stats.data?.total} big />
            <Stat label="Still open" value={stats.data?.open} />
            <Stat label="Reunited" value={stats.data?.resolved} />
          </div>
        </div>
      </section>

      <section id="browse" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold">Recent reports</h2>
            <p className="text-muted-foreground">
              {list.data ? `${list.data.total} result${list.data.total === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-4 shadow-card">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: q.trim() || undefined });
            }}
          >
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={100}
                placeholder="Search by item name or description…"
                className={selectCls + " w-full pl-10"}
              />
            </div>
            <Button type="submit" className="h-11 rounded-xl px-6">Search</Button>
          </form>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <select className={selectCls} value={search.type ?? ""} onChange={(e) => update({ type: (e.target.value || undefined) as ListFilters["type"] })}>
              <option value="">Lost & Found</option>
              <option value="lost">Lost only</option>
              <option value="found">Found only</option>
            </select>
            <select className={selectCls} value={search.category ?? ""} onChange={(e) => update({ category: (e.target.value || undefined) as ListFilters["category"] })}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className={selectCls} value={search.location ?? ""} onChange={(e) => update({ location: (e.target.value || undefined) as ListFilters["location"] })}>
              <option value="">All locations</option>
              {LOCATIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className={selectCls} value={search.status ?? "open"} onChange={(e) => update({ status: e.target.value === "open" ? undefined : (e.target.value as ListFilters["status"]) })}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All statuses</option>
            </select>
            <Button variant="outline" className="h-11 rounded-xl" disabled={!hasFilters} onClick={() => { setQ(""); navigate({ search: {}, resetScroll: false }); }}>
              Clear filters
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {list.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : list.isError ? (
            <Empty title="Couldn't load reports" text="Check your connection and try again.">
              <Button onClick={() => list.refetch()}>Retry</Button>
            </Empty>
          ) : list.data && list.data.items.length === 0 ? (
            <Empty title="No matching reports" text={hasFilters ? "Try a different keyword or clear your filters." : "Nothing reported yet — be the first."}>
              {hasFilters ? (
                <Button variant="outline" onClick={() => navigate({ search: {} })}>Clear filters</Button>
              ) : (
                <Button asChild variant="hero"><Link to="/report">Report an Item</Link></Button>
              )}
            </Empty>
          ) : (
            <div className={"grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity " + (list.isFetching ? "opacity-60" : "")}>
              {list.data?.items.map((it) => <ItemCard key={it.id} item={it} />)}
            </div>
          )}
        </div>

        {list.data && list.data.pageCount > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button variant="outline" disabled={list.data.page <= 1} onClick={() => update({ page: list.data!.page - 1 })}>← Prev</Button>
            <span className="text-sm font-semibold text-muted-foreground">Page {list.data.page} of {list.data.pageCount}</span>
            <Button variant="outline" disabled={list.data.page >= list.data.pageCount} onClick={() => update({ page: list.data!.page + 1 })}>Next →</Button>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, big }: { label: string; value?: number | undefined; big?: boolean }) {
  return (
    <div className={"rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur " + (big ? "col-span-2" : "")}>
      <div className={"font-display font-extrabold " + (big ? "text-6xl text-gradient" : "text-4xl")}>
        {value ?? <span className="inline-block h-10 w-16 animate-pulse rounded bg-muted" />}
      </div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function Empty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5M8 11h6" />
        </svg>
      </div>
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-muted-foreground">{text}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

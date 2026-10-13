import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { PublicItem } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TypeBadge({ type }: { type: "lost" | "found" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        type === "lost" ? "bg-lost-soft text-lost" : "bg-found-soft text-found",
      )}
    >
      <span className={cn("size-1.5 rounded-full", type === "lost" ? "bg-lost" : "bg-found")} />
      {type}
    </span>
  );
}

export function StatusBadge({ status }: { status: "open" | "resolved" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
        status === "open" ? "border-primary/30 text-primary" : "border-border bg-muted text-muted-foreground",
      )}
    >
      {status === "open" ? "Open" : "Resolved ✓"}
    </span>
  );
}

export function ItemPhoto({ item, className }: { item: PublicItem; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (item.imageUrl && !broken) {
    return (
      <img
        src={item.imageUrl}
        alt={item.title}
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-hero bg-primary-soft text-primary/60", className)}>
      <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </svg>
      <span className="text-xs font-semibold">{broken ? "Image unavailable" : "No photo"}</span>
    </div>
  );
}

export function formatDate(d: string) {
  return new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ItemCard({ item }: { item: PublicItem }) {
  return (
    <Link
      to="/items/$id"
      params={{ id: item.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <ItemPhoto item={item} className="transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-2">
          <TypeBadge type={item.reportType} />
        </div>
        {item.isSample && (
          <span className="absolute right-3 top-3 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Sample
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-lg font-bold">{item.title}</h3>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.category}</p>
        <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s-7-6.5-7-12a7 7 0 1114 0c0 5.5-7 12-7 12z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {item.location}
          </span>
          <span>{formatDate(item.eventDate)}</span>
        </div>
        <span className="text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
          View details →
        </span>
      </div>
    </Link>
  );
}

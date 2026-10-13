// Edit these lists to change the dropdown options across the whole app.
export const CATEGORIES = [
  "Electronics",
  "ID & Documents",
  "Books & Stationery",
  "Bags & Wallets",
  "Keys",
  "Clothing & Accessories",
  "Other",
] as const;

export const LOCATIONS = [
  "Library",
  "Canteen",
  "Main Block",
  "Hostel Area",
  "Sports Ground",
  "Parking Area",
  "Other",
] as const;

export const PAGE_SIZE = 12;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PublicItem = {
  id: string;
  reportType: "lost" | "found";
  title: string;
  category: string;
  location: string;
  locationDetail: string | null;
  eventDate: string;
  description: string;
  imageUrl: string | null;
  status: "open" | "resolved";
  resolvedAt: string | null;
  reporterName: string;
  isSample: boolean;
  createdAt: string;
};

export type ItemMessage = {
  id: string;
  senderName: string;
  senderContact: string;
  body: string;
  createdAt: string;
};

/** Returns an error message, or null if the date is within the last year and not in the future. */
export function checkEventDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Please pick a valid date.";
  const d = new Date(value + "T00:00:00Z").getTime();
  if (Number.isNaN(d)) return "Please pick a valid date.";
  const now = Date.now();
  if (d > now + 24 * 3600 * 1000) return "Date cannot be in the future.";
  if (d < now - 366 * 24 * 3600 * 1000) return "Date cannot be older than one year.";
  return null;
}

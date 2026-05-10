import type { Part } from "./types";

/** Trim BOM / inventory SKU for comparisons (preserve inner case). */
export function normalizeSku(s: string): string {
  return s.trim();
}

/**
 * Match rank for sorting: lower = higher priority (SKUs before names).
 * Returns null if the part does not match the query.
 */
function matchRank(part: Part, qRaw: string): number | null {
  const q = qRaw.trim().toLowerCase();
  if (!q) return 0;

  const pn = normalizeSku(part.partNumber).toLowerCase();
  const name = part.name.toLowerCase();
  const company = part.company.toLowerCase();
  const drawer = part.drawerId.toLowerCase();
  const cat = part.category.toLowerCase();

  if (pn) {
    if (pn === q) return 0;
    if (pn.startsWith(q)) return 1;
    if (pn.includes(q)) return 2;
  }
  if (name.includes(q)) return 10;
  if (company.includes(q)) return 11;
  if (drawer.includes(q)) return 12;
  if (cat.includes(q)) return 13;
  return null;
}

/** Filter by category chip and search across name, SKU, company, drawer, category — SKU matches sort first. */
export function filterAndSortPartsForSearch(
  parts: Part[],
  searchRaw: string,
  selectedCategory: string
): Part[] {
  const q = searchRaw.trim();
  const catOk = (p: Part) =>
    selectedCategory === "All" || p.category === selectedCategory;

  if (!q) {
    return parts.filter(catOk);
  }

  const ranked: { part: Part; rank: number }[] = [];
  for (const part of parts) {
    if (!catOk(part)) continue;
    const rank = matchRank(part, q);
    if (rank !== null) ranked.push({ part, rank });
  }
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.part.name.localeCompare(b.part.name);
  });
  return ranked.map((r) => r.part);
}

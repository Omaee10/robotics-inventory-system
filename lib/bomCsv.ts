import type { Drawer, Part } from "./types";
import { normalizeSku } from "./partSearch";

export interface BomCsvRequirement {
  partNumber: string;
  quantity: number;
}

export interface BomMatchedRow {
  partNumber: string;
  bomQuantity: number;
  matched: boolean;
  dbQuantity: number | null;
  drawerLabel: string | null;
  deficit: number | null;
  vendorUrl: string;
}

export interface BomParseResult {
  ok: boolean;
  requirements: BomCsvRequirement[];
  errors: string[];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Split one CSV line respecting double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findSkuColumnIndex(headers: string[]): number {
  const normalized = headers.map(normHeader);
  const skuIdx = normalized.findIndex(
    (h) =>
      h === "sku" ||
      h === "part number" ||
      h === "partnumber" ||
      h === "part #" ||
      h === "part no" ||
      h === "part no."
  );
  return skuIdx;
}

function findQuantityColumnIndex(headers: string[]): number {
  const normalized = headers.map(normHeader);
  const candidates = ["quantity", "qty", "q", "qty.", "amount", "count"];
  for (const want of candidates) {
    const idx = normalized.indexOf(want);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parse a BOM CSV: requires a column titled `Part Number` or `SKU`, and a quantity column. */
export function parseBomCsv(text: string): BomParseResult {
  const errors: string[] = [];
  const raw = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((ln) => ln.trim().length > 0);
  if (lines.length < 2) {
    return {
      ok: false,
      requirements: [],
      errors: ["CSV must include a header row and at least one data row."],
    };
  }

  const headers = splitCsvLine(lines[0]);
  const skuCol = findSkuColumnIndex(headers);
  const qtyCol = findQuantityColumnIndex(headers);

  if (skuCol < 0) {
    errors.push('Missing column: add a column titled "Part Number" or "SKU".');
  }
  if (qtyCol < 0) {
    errors.push(
      'Missing quantity column: use "Quantity", "Qty", "Amount", or "Count".'
    );
  }
  if (errors.length) {
    return { ok: false, requirements: [], errors };
  }

  const totals = new Map<string, number>();

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const skuRaw = cells[skuCol] ?? "";
    const sku = normalizeSku(skuRaw);
    if (!sku) continue;

    const qtyStr = cells[qtyCol] ?? "0";
    const qty = Number.parseFloat(qtyStr.replace(/,/g, ""));
    if (!Number.isFinite(qty) || qty < 0) {
      errors.push(`Row ${r + 1}: invalid quantity for "${sku}".`);
      continue;
    }
    const rounded = Math.round(qty);
    if (Math.abs(qty - rounded) > 1e-6) {
      errors.push(`Row ${r + 1}: quantity must be a whole number ("${sku}").`);
      continue;
    }
    totals.set(sku, (totals.get(sku) ?? 0) + rounded);
  }

  const requirements: BomCsvRequirement[] = Array.from(totals.entries()).map(
    ([partNumber, quantity]) => ({ partNumber, quantity })
  );

  if (requirements.length === 0) {
    errors.push("No part numbers with quantities were found.");
  }

  return {
    ok: errors.length === 0 && requirements.length > 0,
    requirements,
    errors,
  };
}

/** Build lookup map: exact BOM.part_number === DB.part_number (trimmed). */
export function buildPartNumberIndex(parts: Part[]): Map<string, Part> {
  const map = new Map<string, Part>();
  for (const p of parts) {
    const key = normalizeSku(p.partNumber);
    if (!key) continue;
    map.set(key, p);
  }
  return map;
}

export function matchBomToInventory(
  requirements: BomCsvRequirement[],
  parts: Part[],
  drawers: Drawer[]
): BomMatchedRow[] {
  const index = buildPartNumberIndex(parts);

  return requirements.map((req) => {
    const db = index.get(req.partNumber) ?? null;
    const drawerLabel = db
      ? drawers.find((d) => d.id === db.drawerId)?.label ?? db.drawerId
      : null;

    if (!db) {
      return {
        partNumber: req.partNumber,
        bomQuantity: req.quantity,
        matched: false,
        dbQuantity: null,
        drawerLabel: null,
        deficit: null,
        vendorUrl: "",
      };
    }

    const deficit = req.quantity - db.quantity;
    return {
      partNumber: req.partNumber,
      bomQuantity: req.quantity,
      matched: true,
      dbQuantity: db.quantity,
      drawerLabel,
      deficit,
      vendorUrl: (db.vendorUrl ?? "").trim(),
    };
  });
}

export interface OrderListRow {
  partNumber: string;
  quantityToBuy: number;
  vendorUrl: string;
}

/** Rows to purchase: matched parts with deficit > 0, plus unmatched BOM lines (buy full BOM qty). */
export function buildOrderList(rows: BomMatchedRow[]): OrderListRow[] {
  const out: OrderListRow[] = [];
  for (const r of rows) {
    if (!r.matched) {
      if (r.bomQuantity > 0) {
        out.push({
          partNumber: r.partNumber,
          quantityToBuy: r.bomQuantity,
          vendorUrl: "",
        });
      }
      continue;
    }
    if (r.deficit !== null && r.deficit > 0) {
      out.push({
        partNumber: r.partNumber,
        quantityToBuy: r.deficit,
        vendorUrl: r.vendorUrl,
      });
    }
  }
  return out;
}

export function downloadOrderListCsv(rows: OrderListRow[], filenameBase: string) {
  const headers = ["Part Number", "Quantity to buy", "Vendor URL"];
  const body = rows.map((row) => [
    row.partNumber,
    String(row.quantityToBuy),
    row.vendorUrl,
  ]);
  const csv = [headers, ...body]
    .map((line) =>
      line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-order-list-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

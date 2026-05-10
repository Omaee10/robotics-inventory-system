"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Drawer, Part } from "@/lib/types";
import {
  parseBomCsv,
  matchBomToInventory,
  buildOrderList,
  downloadOrderListCsv,
  type BomMatchedRow,
  type BomCsvRequirement,
} from "@/lib/bomCsv";

interface BomAnalysisProps {
  parts: Part[];
  drawers: Drawer[];
  /** Used for the downloadable CSV filename (e.g. frc). */
  programSlug: string;
}

export default function BomAnalysis({
  parts,
  drawers,
  programSlug,
}: BomAnalysisProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<BomCsvRequirement[] | null>(
    null
  );

  const reset = useCallback(() => {
    setFileLabel(null);
    setParseErrors([]);
    setRequirements(null);
    // Allow choosing the same CSV again (browser skips change if value unchanged).
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const onPickFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setParseErrors([]);
      setRequirements(null);
      setFileLabel(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed = parseBomCsv(text);
        setParseErrors(parsed.errors);
        if (parsed.ok) {
          setRequirements(parsed.requirements);
        }
      };
      reader.onerror = () => {
        setParseErrors(["Could not read that file."]);
      };
      reader.readAsText(file);
    },
    []
  );

  const hasBomSession =
    Boolean(fileLabel) || Boolean(requirements) || parseErrors.length > 0;

  const matchedRows: BomMatchedRow[] | null = useMemo(() => {
    if (!requirements?.length) return null;
    return matchBomToInventory(requirements, parts, drawers);
  }, [requirements, parts, drawers]);

  const orderRows = useMemo(
    () => (matchedRows ? buildOrderList(matchedRows) : []),
    [matchedRows]
  );

  return (
    <section className="mb-10 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-bold text-gray-900">BOM analysis</h2>
        <p className="text-xs text-gray-500 mt-1">
          Upload a CSV with a <strong>Part Number</strong> or <strong>SKU</strong> column and a{" "}
          <strong>Quantity</strong> column. Rows match inventory by exact part number (trimmed).
          Deficit = BOM quantity − quantity on hand.
        </p>
      </div>

      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          Choose BOM CSV
        </label>
        {fileLabel && (
          <span className="text-xs text-gray-600 truncate" title={fileLabel}>
            {fileLabel}
          </span>
        )}
        {hasBomSession && (
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 underline sm:ml-auto"
          >
            Clear
          </button>
        )}
      </div>

      {parseErrors.length > 0 && (
        <div className="px-5 pb-5">
          <ul className="text-xs text-red-600 space-y-1 list-disc list-inside bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {parseErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {matchedRows && matchedRows.length > 0 && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                downloadOrderListCsv(orderRows, `robotics-${programSlug}`)
              }
              disabled={orderRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Download order list
            </button>
            <span className="text-xs text-gray-500">
              CSV columns: Part Number, Quantity to buy, Vendor URL (shortfalls + parts not in inventory).
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-3 py-2.5">Part number</th>
                  <th className="px-3 py-2.5">BOM qty</th>
                  <th className="px-3 py-2.5">In stock</th>
                  <th className="px-3 py-2.5">Drawer</th>
                  <th className="px-3 py-2.5">Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matchedRows.map((row) => (
                  <tr key={row.partNumber} className="text-gray-800">
                    <td className="px-3 py-2 font-mono text-xs">{row.partNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{row.bomQuantity}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.matched ? row.dbQuantity : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.drawerLabel ?? (
                        <span className="text-amber-700 font-medium">Not in inventory</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.deficit === null ? (
                        <span className="text-gray-400">—</span>
                      ) : row.deficit > 0 ? (
                        <span className="text-red-600 font-semibold">{row.deficit}</span>
                      ) : (
                        <span className="text-green-700">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

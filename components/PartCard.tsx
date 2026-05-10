"use client";

import { useState, useEffect } from "react";
import { Drawer, Part } from "@/lib/types";
import { normalizeSku } from "@/lib/partSearch";
import { useToast } from "@/lib/toastContext";
import QuantityPopup from "./QuantityPopup";

interface PartCardProps {
  part: Part;
  drawers: Drawer[];
  canEdit?: boolean;
  onEdit: (part: Part) => void;
  onDelete: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => Promise<void>;
}

type PopupMode = "take" | "add" | null;

const CATEGORY_COLORS: Record<string, string> = {
  Motors: "bg-orange-100 text-orange-700",
  Electronics: "bg-blue-100 text-blue-700",
  Sensors: "bg-purple-100 text-purple-700",
  Pneumatics: "bg-cyan-100 text-cyan-700",
  Drive: "bg-green-100 text-green-700",
  Vision: "bg-pink-100 text-pink-700",
};

const CATEGORY_COLOR_FALLBACK_PALETTE = [
  "bg-amber-100 text-amber-800",
  "bg-indigo-100 text-indigo-800",
  "bg-teal-100 text-teal-800",
  "bg-rose-100 text-rose-800",
  "bg-lime-100 text-lime-800",
  "bg-fuchsia-100 text-fuchsia-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
];

function categoryColorClass(label: string): string {
  if (CATEGORY_COLORS[label]) return CATEGORY_COLORS[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_COLOR_FALLBACK_PALETTE[h % CATEGORY_COLOR_FALLBACK_PALETTE.length];
}

export default function PartCard({
  part,
  drawers,
  canEdit = true,
  onEdit,
  onDelete,
  onAdjustQuantity,
}: PartCardProps) {
  const [popup, setPopup] = useState<PopupMode>(null);
  const [isEjecting, setIsEjecting] = useState(false);
  const [ejectPopupOpen, setEjectPopupOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { addToast } = useToast();

  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setImgOk(true);
  }, [part.imageUrl]);

  const isLow = part.quantity <= part.minQuantity;
  const categoryColor = categoryColorClass(part.category);

  const drawerLabel =
    drawers.find((d) => d.id === part.drawerId)?.label ?? part.drawerId;

  const handlePopupConfirm = async (amount: number) => {
    const delta = popup === "take" ? -amount : amount;
    setPopup(null);
    await onAdjustQuantity(part.id, delta);
    addToast(
      popup === "take"
        ? `Took ${amount}× ${part.name}`
        : `Added ${amount}× ${part.name}`
    );
  };

  const handleEject = () => {
    setIsEjecting(true);
    setTimeout(() => setIsEjecting(false), 600);
    console.log(`[Eject] Drawer triggered: ${drawerLabel} (id: ${part.drawerId})`);
    setEjectPopupOpen(true);
  };

  return (
    <>
      <div className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        {/* Low stock banner */}
        {isLow && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1 tracking-wide">
            ⚠ LOW STOCK
          </div>
        )}

        {/* Part image */}
        <div
          className={`relative w-full h-44 bg-slate-100 ${isLow ? "mt-6" : ""}`}
        >
          {imgOk ? (
            <img
              src={part.imageUrl}
              alt={part.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200 px-3 text-center text-xs font-medium text-slate-500">
              {part.name.slice(0, 40)}
              {part.name.length > 40 ? "…" : ""}
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4 flex flex-col gap-3">
          {/* Name + info + category */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {normalizeSku(part.partNumber) ? (
                <p className="font-mono text-[11px] font-semibold text-slate-600 tracking-tight mb-0.5 truncate">
                  {normalizeSku(part.partNumber)}
                </p>
              ) : null}
              <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">
                {part.name}
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                title="Part details"
                aria-label={`Details for ${part.name}`}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColor}`}
              >
                {part.category}
              </span>
            </div>
          </div>

          {/* Drawer ID + Eject button */}
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-slate-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
            <span className="text-xs text-slate-500">Drawer</span>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              {drawerLabel}
            </span>

            {/* Eject Drawer button */}
            <button
              onClick={handleEject}
              title={`Eject ${drawerLabel}`}
              className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                isEjecting
                  ? "bg-black text-white border-black scale-95"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 hover:border-gray-500"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <polyline points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
              Eject
            </button>
          </div>

          {/* Quantity + +/- controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Qty</span>
              <span
                className={`text-2xl font-bold tabular-nums leading-none ${
                  isLow ? "text-amber-600" : "text-slate-800"
                }`}
              >
                {part.quantity}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Take button */}
              <button
                onClick={() => setPopup("take")}
                disabled={part.quantity === 0}
                title="Take parts"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-base leading-none font-bold">−</span>
                Take
              </button>

              {/* Add button */}
              <button
                onClick={() => setPopup("add")}
                title="Add parts"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black hover:bg-gray-800 text-white text-xs font-semibold transition-colors"
              >
                <span className="text-base leading-none font-bold">+</span>
                Add
              </button>
            </div>
          </div>

          {/* Edit / Delete — mentor only */}
          {canEdit && (
            <div className="flex gap-2 pt-1 border-t border-slate-100">
              <button
              onClick={() => onEdit(part)}
              className="flex-1 text-xs font-medium text-gray-700 hover:text-black hover:bg-gray-100 rounded-lg py-1.5 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(part.id)}
                className="flex-1 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg py-1.5 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quantity popup — rendered outside the card so it isn't clipped */}
      {popup && (
        <QuantityPopup
          mode={popup}
          partName={part.name}
          currentQuantity={part.quantity}
          onConfirm={handlePopupConfirm}
          onCancel={() => setPopup(null)}
        />
      )}

      {/* Part info — name + company */}
      {infoOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setInfoOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="part-info-title"
              className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Part
                  </p>
                  <h3
                    id="part-info-title"
                    className="text-base font-bold text-slate-900 leading-snug"
                  >
                    {part.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Part number (SKU)
                  </p>
                  <p className="text-sm font-mono font-medium text-slate-800">
                    {normalizeSku(part.partNumber)
                      ? normalizeSku(part.partNumber)
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Company / supplier
                  </p>
                  <p className="text-sm font-medium text-slate-800">
                    {part.company.trim()
                      ? part.company
                      : "Not specified"}
                  </p>
                </div>
                {part.vendorUrl.trim() &&
                  /^https?:\/\//i.test(part.vendorUrl.trim()) && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Vendor URL
                      </p>
                      <a
                        href={part.vendorUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline break-all"
                      >
                        {part.vendorUrl.trim()}
                      </a>
                    </div>
                  )}
              </div>
              <div className="px-6 pb-5">
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-semibold transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Eject confirmation popup */}
      {ejectPopupOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setEjectPopupOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
              {/* Header strip */}
              <div className="bg-black px-6 pt-6 pb-5 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    <line x1="12" y1="12" x2="12" y2="16" />
                    <line x1="10" y1="14" x2="14" y2="14" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">
                    Ejected
                  </p>
                  <h3 className="text-white font-bold text-base leading-snug">
                    {drawerLabel}
                  </h3>
                  <p className="text-blue-200 text-xs mt-1">{part.name}</p>
                </div>
              </div>
              {/* Body */}
              <div className="px-6 py-5">
                <button
                  onClick={() => setEjectPopupOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

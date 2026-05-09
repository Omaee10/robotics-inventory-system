"use client";

import { useEffect, useRef, useState } from "react";

interface QuantityPopupProps {
  mode: "take" | "add";
  partName: string;
  currentQuantity: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

export default function QuantityPopup({
  mode,
  partName,
  currentQuantity,
  onConfirm,
  onCancel,
}: QuantityPopupProps) {
  const [amount, setAmount] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const isTake = mode === "take";
  const max = isTake ? currentQuantity : 9999;

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onCancel();
  };

  const handleConfirm = () => {
    const clamped = Math.max(1, Math.min(amount, max));
    onConfirm(clamped);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Coloured header strip */}
          <div
            className={`px-6 pt-5 pb-4 ${
              isTake
                ? "bg-gradient-to-br from-gray-900 to-gray-800"
                : "bg-gradient-to-br from-black to-gray-800"
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-lg">
                {isTake ? "📤" : "📥"}
              </div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-widest">
                {isTake ? "Checking Out" : "Restocking"}
              </p>
            </div>
            <h2 className="text-white font-bold text-base leading-tight">
              {isTake ? "How many are you taking?" : "How many are you adding?"}
            </h2>
            <p className="text-white/60 text-xs mt-1 truncate">{partName}</p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Quantity input with stepper */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAmount((v) => Math.max(1, v - 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xl flex items-center justify-center transition-colors select-none"
              >
                −
              </button>

              <input
                ref={inputRef}
                type="number"
                min={1}
                max={max}
                value={amount}
                onChange={(e) =>
                  setAmount(Math.max(1, parseInt(e.target.value) || 1))
                }
                onKeyDown={handleKeyDown}
                className="w-24 text-center text-3xl font-bold text-gray-900 border-2 border-gray-200 rounded-xl py-2 focus:outline-none focus:border-black transition-colors tabular-nums"
              />

              <button
                type="button"
                onClick={() => setAmount((v) => Math.min(max, v + 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xl flex items-center justify-center transition-colors select-none"
              >
                +
              </button>
            </div>

            {isTake && (
              <p className="text-center text-xs text-slate-400">
                {currentQuantity - Math.min(amount, max)} will remain in stock
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={amount < 1 || (isTake && amount > currentQuantity)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-40 ${
                  isTake
                    ? "bg-gray-900 hover:bg-gray-700"
                    : "bg-black hover:bg-gray-800"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

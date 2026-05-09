"use client";

import { useRef, useState } from "react";
import { Drawer } from "@/lib/types";
import { deleteDrawer, insertDrawer } from "@/lib/supabase";

interface DrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawers: Drawer[];
  onDrawersChange: (drawers: Drawer[]) => void;
}

export default function DrawerModal({
  isOpen,
  onClose,
  drawers,
  onDrawersChange,
}: DrawerModalProps) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    if (drawers.some((d) => d.label.toLowerCase() === trimmed.toLowerCase())) {
      setError("A drawer with that name already exists.");
      return;
    }

    setSaving(true);
    setError("");
    const { data: created, error: saveError } = await insertDrawer(trimmed);
    if (created) {
      const updated = [...drawers, created].sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      onDrawersChange(updated);
      setLabel("");
      inputRef.current?.focus();
    } else {
      setError(saveError ?? "Failed to save. Check your Supabase connection.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error: deleteError } = await deleteDrawer(id);
    if (!deleteError) {
      onDrawersChange(drawers.filter((d) => d.id !== id));
    } else {
      setError(deleteError);
    }
    setDeletingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2
              id="drawer-modal-title"
              className="text-lg font-bold text-slate-800"
            >
              Manage Drawers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {drawers.length} drawer{drawers.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="px-6 py-4 border-b border-slate-100 shrink-0"
        >
          <label className="text-sm font-medium text-slate-700 block mb-2">
            New Drawer Label
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. Drawer 5: Fasteners"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setError("");
              }}
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              {saving ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
              Add
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
        </form>

        {/* Drawer list */}
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {drawers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No drawers yet. Add one above.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {drawers.map((drawer) => (
                <li
                  key={drawer.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
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
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {drawer.label}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(drawer.id)}
                    disabled={deletingId === drawer.id}
                    title="Delete drawer"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                  >
                    {deletingId === drawer.id ? (
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

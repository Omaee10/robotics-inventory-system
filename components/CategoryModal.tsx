"use client";

import { useRef, useState } from "react";
import type { Part, PartCategory } from "@/lib/types";
import { deleteCategory, insertCategory } from "@/lib/supabase";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: PartCategory[];
  parts: Part[];
  onCategoriesChange: (categories: PartCategory[]) => void;
}

export default function CategoryModal({
  isOpen,
  onClose,
  categories,
  parts,
  onCategoriesChange,
}: CategoryModalProps) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const partCountForLabel = (catLabel: string) =>
    parts.filter((p) => p.category === catLabel).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    if (
      categories.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError("A section with that name already exists.");
      return;
    }

    setSaving(true);
    setError("");
    const { data: created, error: saveError } = await insertCategory(trimmed);
    if (created) {
      const updated = [...categories, created].sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      onCategoriesChange(updated);
      setLabel("");
      inputRef.current?.focus();
    } else {
      setError(saveError ?? "Failed to save. Check your Supabase connection.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, catLabel: string) => {
    const n = partCountForLabel(catLabel);
    if (n > 0) {
      setError(
        `Cannot remove "${catLabel}" — ${n} part(s) still use it. Reassign them first.`
      );
      return;
    }
    setError("");
    setDeletingId(id);
    const { error: deleteError } = await deleteCategory(id);
    if (!deleteError) {
      onCategoriesChange(categories.filter((c) => c.id !== id));
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
      aria-labelledby="category-modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2
              id="category-modal-title"
              className="text-lg font-bold text-slate-800"
            >
              Manage sections
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Categories for filters and organizing parts ({categories.length}{" "}
              total)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleAdd}
          className="px-6 py-4 border-b border-slate-100 shrink-0"
        >
          <label className="text-sm font-medium text-slate-700 block mb-2">
            New section name
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. Fasteners"
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
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </form>

        <div className="overflow-y-auto flex-1 px-6 py-3">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No sections yet. Add one above, or run{" "}
              <code className="text-xs">supabase/11_categories.sql</code>.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {categories.map((cat) => {
                const n = partCountForLabel(cat.label);
                return (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {cat.label}
                      </span>
                      {n > 0 && (
                        <span className="shrink-0 text-[10px] font-semibold text-slate-400 bg-slate-200/80 px-1.5 py-0.5 rounded-md">
                          {n} part{n !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id, cat.label)}
                      disabled={deletingId === cat.id || n > 0}
                      title={
                        n > 0
                          ? "Reassign parts before removing"
                          : "Remove section"
                      }
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                    >
                      {deletingId === cat.id ? (
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
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
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

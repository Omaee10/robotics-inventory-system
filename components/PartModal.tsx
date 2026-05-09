"use client";

import { useEffect, useState } from "react";
import { Drawer, Part } from "@/lib/types";
import { CATEGORIES } from "@/lib/data";

interface PartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (part: Omit<Part, "id"> & { id?: string }) => void | Promise<void>;
  editPart?: Part | null;
  drawers: Drawer[];
}

const EMPTY_FORM: Omit<Part, "id"> = {
  name: "",
  category: "Electronics",
  quantity: 1,
  drawerId: "",
  imageUrl: "",
  description: "",
  minQuantity: 2,
};

export default function PartModal({
  isOpen,
  onClose,
  onSave,
  editPart,
  drawers,
}: PartModalProps) {
  const [form, setForm] = useState<Omit<Part, "id">>(EMPTY_FORM);

  useEffect(() => {
    if (editPart) {
      setForm({
        name: editPart.name,
        category: editPart.category,
        quantity: editPart.quantity,
        drawerId: editPart.drawerId,
        imageUrl: editPart.imageUrl,
        description: editPart.description,
        minQuantity: editPart.minQuantity,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        drawerId: drawers[0]?.id ?? "",
      });
    }
  }, [editPart, isOpen, drawers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await Promise.resolve(
      onSave({
        ...form,
        id: editPart?.id,
        imageUrl:
          form.imageUrl ||
          `https://placehold.co/400x300/111111/ffffff?text=${encodeURIComponent(form.name || "Part")}`,
      })
    );
    onClose();
  };

  const categories = CATEGORIES.filter((c) => c !== "All");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 id="modal-title" className="text-lg font-bold text-slate-800">
            {editPart ? "Edit Part" : "Add New Part"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Part Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. REV Through Bore Encoder"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Drawer <span className="text-red-500">*</span>
            </label>
            {drawers.length > 0 ? (
              <select
                required
                value={form.drawerId}
                onChange={(e) =>
                  setForm({ ...form, drawerId: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              >
                <option value="" disabled>
                  Select a drawer…
                </option>
                {drawers.map((drawer) => (
                  <option key={drawer.id} value={drawer.id}>
                    {drawer.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                type="text"
                placeholder="e.g. A-01"
                value={form.drawerId}
                onChange={(e) =>
                  setForm({ ...form, drawerId: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Quantity
              </label>
              <input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Low-Stock Threshold
              </label>
              <input
                type="number"
                min={0}
                value={form.minQuantity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minQuantity: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Image URL{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Description{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of the part..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              {editPart ? "Save Changes" : "Add Part"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

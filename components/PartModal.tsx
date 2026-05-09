"use client";

import { useEffect, useState } from "react";
import { Drawer, Part, Vendor } from "@/lib/types";
import { CATEGORIES } from "@/lib/data";
import { useToast } from "@/lib/toastContext";

interface PartModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the modal open (save failed). Otherwise it closes. */
  onSave: (
    part: Omit<Part, "id"> & { id?: string }
  ) => void | boolean | Promise<void | boolean>;
  editPart?: Part | null;
  drawers: Drawer[];
  vendors?: Vendor[];
}

const EMPTY_FORM: Omit<Part, "id"> = {
  name: "",
  company: "",
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
  vendors = [],
}: PartModalProps) {
  const { addToast } = useToast();
  const [form, setForm] = useState<Omit<Part, "id">>(EMPTY_FORM);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [imgSearching, setImgSearching] = useState(false);
  const [imgMsg, setImgMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const scrapeImage = async (url: string) => {
    if (!url.trim().startsWith("http")) return;
    setImgMsg(null);
    setImgSearching(true);
    try {
      const res = await fetch(
        `/api/fetch-image?vendor_url=${encodeURIComponent(url.trim())}`
      );
      const data: { url?: string; source?: string; error?: string } =
        await res.json();

      if (data.url) {
        setForm((prev) => ({ ...prev, imageUrl: data.url! }));
        const pageSources = new Set([
          "og:image",
          "twitter:image",
          "json-ld",
          "link:image_src",
          "microdata",
        ]);
        const label = pageSources.has(data.source ?? "")
          ? "Extracted from product page"
          : "Using placeholder";
        setImgMsg({ text: `✓ ${label}`, ok: true });
      } else {
        setImgMsg({ text: data.error ?? "No image found on that page", ok: false });
      }
    } catch {
      setImgMsg({ text: "Scrape failed — check your connection", ok: false });
    } finally {
      setImgSearching(false);
    }
  };

  const handleFindByName = async () => {
    if (!form.name.trim()) return;
    setImgMsg(null);
    setImgSearching(true);
    try {
      const res = await fetch(
        `/api/fetch-image?query=${encodeURIComponent(form.name)}`
      );
      const data: { url?: string; source?: string; error?: string } =
        await res.json();

      if (data.url) {
        setForm((prev) => ({ ...prev, imageUrl: data.url! }));
        setImgMsg({ text: "✓ Found via image search", ok: true });
      } else {
        setImgMsg({ text: data.error ?? "No image found", ok: false });
      }
    } catch {
      setImgMsg({ text: "Search failed — check your connection", ok: false });
    } finally {
      setImgSearching(false);
    }
  };

  useEffect(() => {
    setImgMsg(null);
    setProductUrl("");
    setSelectedVendorId("");
    if (editPart) {
      setForm({
        name: editPart.name,
        company: editPart.company,
        category: editPart.category,
        quantity: editPart.quantity,
        drawerId: editPart.drawerId,
        imageUrl: editPart.imageUrl,
        description: editPart.description,
        minQuantity: editPart.minQuantity,
      });
    } else {
      setForm({ ...EMPTY_FORM, drawerId: drawers[0]?.id ?? "" });
    }
  }, [editPart, isOpen, drawers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      addToast("Enter a part name.", "error");
      return;
    }

    if (drawers.length > 0) {
      if (!form.drawerId) {
        addToast("Choose a drawer for this part.", "error");
        return;
      }
    } else if (!form.drawerId.trim()) {
      addToast(
        "Enter a drawer label, or use the Drawers button and try again.",
        "error"
      );
      return;
    }

    const trimmedImg = form.imageUrl.trim();
    if (trimmedImg && !/^https?:\/\//i.test(trimmedImg)) {
      addToast(
        "Image URL must start with http:// or https:// — or leave it blank.",
        "error"
      );
      return;
    }

    const payload = {
      ...form,
      id: editPart?.id,
      imageUrl:
        trimmedImg ||
        `https://placehold.co/400x300/111111/ffffff?text=${encodeURIComponent(form.name || "Part")}`,
    };

    try {
      const result = onSave(payload);
      const outcome = await Promise.resolve(result);
      if (outcome === false) return;
      onClose();
    } catch (err) {
      console.error(err);
      addToast(
        err instanceof Error ? err.message : "Could not save the part.",
        "error"
      );
    }
  };

  const categories = CATEGORIES.filter((c) => c !== "All");
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
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

        <form
          onSubmit={handleSubmit}
          noValidate
          className="px-6 py-5 flex flex-col gap-4"
        >
          {/* Part Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Part Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. REV Through Bore Encoder"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            />
          </div>

          {/* Company / supplier — shown in inventory info popup */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Company / supplier{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. REV Robotics"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            />
            <p className="text-[11px] text-slate-400">
              Choosing a vendor below fills this automatically; you can edit it.
            </p>
          </div>

          {/* Category */}
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

          {/* Drawer */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Drawer <span className="text-red-500">*</span>
            </label>
            {drawers.length > 0 ? (
              <select
                value={form.drawerId}
                onChange={(e) => setForm({ ...form, drawerId: e.target.value })}
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
                type="text"
                placeholder="e.g. A-01"
                value={form.drawerId}
                onChange={(e) => setForm({ ...form, drawerId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              />
            )}
          </div>

          {/* Qty + threshold */}
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
                  setForm({ ...form, minQuantity: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              />
            </div>
          </div>

          {/* ── Image section ── */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Product Image
            </p>

            {/* Vendor dropdown */}
            {vendors.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Vendor{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedVendorId(id);
                    setProductUrl("");
                    setImgMsg(null);
                    const v = vendors.find((x) => x.id === id);
                    if (v) {
                      setForm((prev) => ({ ...prev, company: v.name }));
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                >
                  <option value="">— No vendor / any URL —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {selectedVendor && (
                  <p className="text-xs text-slate-400">
                    Paste a product URL from{" "}
                    <a
                      href={selectedVendor.base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-slate-600"
                    >
                      {selectedVendor.base_url}
                    </a>
                  </p>
                )}
              </div>
            )}

            {/* Product URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Product URL{" "}
                <span className="text-slate-400 font-normal">
                  — optional; click Fetch to try reading the page
                </span>
              </label>
              <p className="text-[11px] text-slate-400 leading-snug">
                Fetch reads Open Graph tags, JSON-LD product data, and similar hints in the HTML. Sites that only paint images with JavaScript still need a direct image URL (right-click image → copy address).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={
                    selectedVendor
                      ? `${selectedVendor.base_url}/products/…`
                      : "https://www.revrobotics.com/products/…"
                  }
                  value={productUrl}
                  onChange={(e) => {
                    setProductUrl(e.target.value);
                    setImgMsg(null);
                  }}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => scrapeImage(productUrl)}
                  disabled={imgSearching || !productUrl.trim().startsWith("http")}
                  title="Fetch image from this URL"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {imgSearching ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  {imgSearching ? "Fetching…" : "Fetch"}
                </button>
              </div>
            </div>

            {/* Status message */}
            {imgMsg && (
              <p className={`text-xs font-medium ${imgMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {imgMsg.text}
              </p>
            )}

            {/* Image URL (editable fallback) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                Image URL
                <span className="text-slate-400 font-normal text-xs">(auto-filled or paste directly)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="Will be filled automatically…"
                  value={form.imageUrl}
                  onChange={(e) => {
                    setForm({ ...form, imageUrl: e.target.value });
                    setImgMsg(null);
                  }}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={handleFindByName}
                  disabled={imgSearching || !form.name.trim()}
                  title={form.name.trim() ? "Search image by part name" : "Enter a part name first"}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {imgSearching ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  )}
                  Search
                </button>
              </div>
            </div>

            {/* Image preview */}
            {form.imageUrl && !imgSearching && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white h-28 flex items-center justify-center">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            {imgSearching && (
              <div className="rounded-xl border border-slate-200 bg-white h-28 flex items-center justify-center">
                <p className="text-xs text-slate-400 animate-pulse">Fetching image…</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Description{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of the part..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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

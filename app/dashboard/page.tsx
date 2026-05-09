"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PartCard from "@/components/PartCard";
import PartModal from "@/components/PartModal";
import DrawerModal from "@/components/DrawerModal";
import { Drawer, Part } from "@/lib/types";
import { CATEGORIES } from "@/lib/data";
import {
  fetchDrawers,
  fetchParts,
  insertPart,
  updatePartQuantity,
  logActivity,
} from "@/lib/supabase";
import { useToast } from "@/lib/toastContext";
import { useSession } from "@/lib/sessionContext";

export default function StudentDashboard() {
  const { session, sessionHydrated, logout } = useSession();
  const router = useRouter();
  const { addToast } = useToast();

  const [parts, setParts] = useState<Part[]>([]);
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (session === null) router.replace("/");
  }, [session, sessionHydrated, router]);

  const loadParts = useCallback(async () => {
    setLoading(true);
    const data = await fetchParts();
    if (data !== null) {
      setParts(data);
    } else {
      addToast("Could not load parts from the database.", "error");
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadParts();
    fetchDrawers().then((data) => { if (data) setDrawers(data); });
  }, [loadParts]);

  const filteredParts = useMemo(() => {
    const q = search.toLowerCase();
    return parts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.drawerId.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === "All" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [parts, search, selectedCategory]);

  const stats = useMemo(() => {
    const total = parts.reduce((sum, p) => sum + p.quantity, 0);
    const lowStock = parts.filter((p) => p.quantity <= p.minQuantity).length;
    return { totalParts: parts.length, totalItems: total, lowStock };
  }, [parts]);

  const handleAdjustQuantity = async (id: string, delta: number) => {
    const part = parts.find((p) => p.id === id);
    let newQuantity = 0;
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        newQuantity = Math.max(0, p.quantity + delta);
        return { ...p, quantity: newQuantity };
      })
    );

    const ok = await updatePartQuantity(id, newQuantity);
    if (!ok) {
      setParts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, quantity: p.quantity - delta } : p))
      );
      addToast("Failed to update quantity in database.", "error");
      return;
    }

    if (part && session) {
      const action = delta < 0 ? "take" : "add";
      await logActivity({
        user_name: session.name,
        action,
        part_name: part.name,
        part_id: id,
        details: `${action === "take" ? "Took" : "Added"} ${Math.abs(delta)} × ${part.name}`,
      });
    }
  };

  const handleSave = async (data: Omit<Part, "id"> & { id?: string }) => {
    if (data.id) return;
    const { id: _ignored, ...partData } = { id: undefined, ...data };
    const { data: created, error } = await insertPart(partData);
    if (created) {
      setParts((prev) => [created, ...prev]);
      addToast(`${created.name} added to inventory.`);
      if (session) {
        await logActivity({
          user_name: session.name,
          action: "add_part",
          part_name: created.name,
          part_id: created.id,
          details: `Added new part: ${created.name}`,
        });
      }
    } else {
      addToast(error || "Failed to add part.", "error");
    }
  };

  if (!sessionHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-base">Robotics Inventory</h1>
              <p className="text-xs text-gray-400 leading-tight">Parts Manager</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full font-medium">
              🎓 {session.name}
            </span>
            {loading ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                Loading…
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {parts.length} parts
              </span>
            )}
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
            <Image src="/itkan-logo.png" alt="ITKAN" width={36} height={36} className="opacity-80" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Parts" value={stats.totalParts} icon="🗂️" color="bg-gray-100 text-gray-700" />
          <StatCard label="Total Items" value={stats.totalItems} icon="📦" color="bg-gray-100 text-gray-700" />
          <StatCard label="Low Stock" value={stats.lowStock} icon="⚠️"
            color={stats.lowStock > 0 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search by name, category, or drawer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent shadow-sm transition"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add New Part
          </button>
          <button
            type="button"
            onClick={() => setIsDrawerModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold rounded-xl border border-gray-200 shadow-sm transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
            Drawers
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selectedCategory === cat
                  ? "bg-black text-white border-black shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                <div className="h-44 bg-slate-100" />
                <div className="p-4 flex flex-col gap-3">
                  <div className="h-4 bg-slate-100 rounded-full w-3/4" />
                  <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-8 bg-slate-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">
              {filteredParts.length === parts.length
                ? `Showing all ${parts.length} parts`
                : `Showing ${filteredParts.length} of ${parts.length} parts`}
            </p>
            {filteredParts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredParts.map((part) => (
                  <PartCard
                    key={part.id}
                    part={part}
                    drawers={drawers}
                    canEdit={false}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onAdjustQuantity={handleAdjustQuantity}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-3xl">🔍</div>
                <h3 className="font-semibold text-slate-700 mb-1">No parts found</h3>
                <p className="text-sm text-slate-400 max-w-xs">Try adjusting your search or filter, or add a new part.</p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-5 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Add New Part
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <PartModal
        key={isModalOpen ? "student-new" : "closed"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editPart={null}
        drawers={drawers}
      />
      <DrawerModal
        isOpen={isDrawerModalOpen}
        onClose={() => setIsDrawerModalOpen(false)}
        drawers={drawers}
        onDrawersChange={setDrawers}
      />
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color} bg-opacity-60`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium opacity-75">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

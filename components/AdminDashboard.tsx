"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PartCard from "@/components/PartCard";
import PartModal from "@/components/PartModal";
import DrawerModal from "@/components/DrawerModal";
import CategoryModal from "@/components/CategoryModal";
import BomAnalysis from "@/components/BomAnalysis";
import {
  AccessCode,
  Drawer,
  Log,
  Part,
  PartCategory,
  PartSaveResult,
  Program,
  Vendor,
} from "@/lib/types";
import { FALLBACK_PART_CATEGORY_LABELS } from "@/lib/data";
import { filterAndSortPartsForSearch } from "@/lib/partSearch";
import {
  fetchParts,
  insertPart,
  updatePart,
  updatePartQuantity,
  deletePart,
  fetchDrawers,
  fetchCategories,
  fetchLogs,
  fetchAccessCodes,
  insertAccessCode,
  deleteAccessCode,
  logActivity,
  fetchVendors,
  insertVendor,
  updateVendor,
  deleteVendor,
  normalizeProgram,
  deleteLogsForProgram,
} from "@/lib/supabase";
import { useToast } from "@/lib/toastContext";
import { useSession } from "@/lib/sessionContext";

type Tab = "inventory" | "logs" | "codes" | "vendors";

// ── CSV export helper ───────────────────────────────────────────────────────
function exportInventoryCSV(parts: Part[], drawers: Drawer[], program: string) {
  const headers = [
    "Part Number",
    "Name",
    "Company",
    "Program",
    "Category",
    "Drawer",
    "Quantity",
    "Min Quantity",
    "Vendor URL",
    "Description",
  ];
  const rows = parts.map((p) => [
    p.partNumber,
    p.name,
    p.company,
    p.program.toUpperCase(),
    p.category,
    drawers.find((d) => d.id === p.drawerId)?.label ?? p.drawerId,
    String(p.quantity),
    String(p.minQuantity),
    p.vendorUrl ?? "",
    p.description,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `robotics-inventory-${program}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportActivityLogCSV(logs: Log[], program: string) {
  const headers = [
    "Created At (UTC)",
    "Program",
    "User",
    "Action",
    "Part Name",
    "Part ID",
    "Details",
  ];
  const rows = logs.map((log) => [
    log.created_at,
    log.program.toUpperCase(),
    log.user_name,
    log.action,
    log.part_name,
    log.part_id ?? "",
    logDetailsCell(log.details),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `robotics-activity-log-${program}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Hide `[frc]` / `[ftc]` prefix used when DB has no `program` column yet. */
function logDetailsCell(details: string | null | undefined): string {
  if (!details) return "—";
  const s = details.replace(/^\[(frc|ftc)\]\s*/i, "").trim();
  return s || "—";
}

// ── Main component ──────────────────────────────────────────────────────────
/** Inventory, activity log, and CSV exports are scoped to `sectionProgram` (URL: /admin/frc | /admin/ftc). */
export default function AdminDashboard({
  sectionProgram,
}: {
  sectionProgram: Program;
}) {
  const { session, sessionHydrated, logout } = useSession();
  const router = useRouter();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("inventory");

  // Inventory state
  const [parts, setParts] = useState<Part[]>([]);
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [editPart, setEditPart] = useState<Part | null>(null);

  // Logs state
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Access codes state
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState("");

  // Vendors state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: "", base_url: "" });
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorError, setVendorError] = useState("");

  useEffect(() => {
    if (!sessionHydrated) return;
    if (session === null) router.replace("/");
    else if (session.role !== "mentor") router.replace("/dashboard");
  }, [session, sessionHydrated, router]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadParts = useCallback(async () => {
    setLoading(true);
    const data = await fetchParts(sectionProgram);
    if (data !== null) setParts(data);
    else addToast("Could not load parts.", "error");
    setLoading(false);
  }, [sectionProgram, addToast]);

  useEffect(() => {
    if (!sessionHydrated || !session) return;
    loadParts();
    fetchDrawers().then((data) => {
      if (data) setDrawers(data);
    });
    fetchCategories().then((data) => {
      if (data) setCategories(data);
    });
    fetchVendors().then((data) => {
      if (data) setVendors(data);
    });
  }, [sessionHydrated, session, sectionProgram, loadParts]);

  const categoryLabels = useMemo(() => {
    if (categories.length > 0) return categories.map((c) => c.label);
    return [...FALLBACK_PART_CATEGORY_LABELS];
  }, [categories]);

  const sectionFilterChips = useMemo(
    () => ["All", ...categoryLabels],
    [categoryLabels]
  );

  useEffect(() => {
    if (selectedCategory === "All") return;
    if (!categoryLabels.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [categoryLabels, selectedCategory]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const data = await fetchLogs(sectionProgram);
    if (data !== null) setLogs(data);
    else setLogs([]);
    setLogsLoading(false);
  }, [sectionProgram]);

  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    const data = await fetchAccessCodes();
    if (data) setAccessCodes(data);
    setCodesLoading(false);
  }, []);

  const loadVendors = useCallback(async () => {
    setVendorsLoading(true);
    const data = await fetchVendors();
    if (data) setVendors(data);
    setVendorsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "logs") loadLogs();
    if (activeTab === "codes") loadCodes();
    if (activeTab === "vendors") loadVendors();
  }, [activeTab, loadLogs, loadCodes, loadVendors]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const filteredParts = useMemo(
    () =>
      filterAndSortPartsForSearch(parts, search, selectedCategory),
    [parts, search, selectedCategory]
  );

  const stats = useMemo(() => {
    const total = parts.reduce((sum, p) => sum + p.quantity, 0);
    const lowStock = parts.filter((p) => p.quantity <= p.minQuantity);
    return { totalParts: parts.length, totalItems: total, lowStock };
  }, [parts]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleSave = async (
    data: Omit<Part, "id"> & { id?: string }
  ): Promise<PartSaveResult> => {
    if (data.id) {
      const prog = sectionProgram;
      setParts((prev) => {
        if (prog && data.program !== prog) {
          return prev.filter((p) => p.id !== data.id);
        }
        return prev.map((p) =>
          p.id === data.id ? ({ ...data, id: data.id! } as Part) : p
        );
      });
      const ok = await updatePart(data.id, data);
      if (!ok) {
        const msg = "Failed to save changes. Check Supabase or your connection.";
        addToast(msg, "error");
        await loadParts();
        return { ok: false, error: msg };
      }
      try {
        const okLog = await logActivity({
          program: normalizeProgram(data.program ?? sectionProgram),
          user_name: "Mentor",
          action: "edit_part",
          part_name: data.name,
          part_id: data.id,
          details: `Updated ${data.name}`,
        });
        void loadLogs();
        if (!okLog) {
          addToast(
            "Change saved, but activity log failed. Run migration supabase/09_logs_program.sql or check the console.",
            "error"
          );
        }
      } catch (e) {
        console.error("logActivity:", e);
      }
      return { ok: true };
    }
    const { id: _ignored, ...partData } = { id: undefined, ...data };
    const { data: created, error: insertErr } = await insertPart(partData);
    if (created) {
      setParts((prev) => [created, ...prev]);
      setSearch("");
      setSelectedCategory("All");
      addToast(`${created.name} added to inventory.`);
      try {
        const okLog = await logActivity({
          program: normalizeProgram(created.program),
          user_name: "Mentor",
          action: "add_part",
          part_name: created.name,
          part_id: created.id,
          details: `Added new part: ${created.name}`,
        });
        void loadLogs();
        if (!okLog) {
          addToast(
            "Part added, but activity log failed. Run migration supabase/09_logs_program.sql or check the console.",
            "error"
          );
        }
      } catch (e) {
        console.error("logActivity:", e);
      }
      return { ok: true };
    }
    const msg = insertErr || "Failed to add part.";
    addToast(msg, "error");
    return { ok: false, error: msg };
  };

  const handleDelete = async (id: string) => {
    const part = parts.find((p) => p.id === id);
    setParts((prev) => prev.filter((p) => p.id !== id));
    const ok = await deletePart(id);
    if (!ok) {
      addToast("Failed to delete part.", "error");
      await loadParts();
    } else if (part) {
      const okLog = await logActivity({
        program: normalizeProgram(part.program),
        user_name: "Mentor",
        action: "delete_part",
        part_name: part.name,
        part_id: id,
        details: `Deleted ${part.name}`,
      });
      void loadLogs();
      if (!okLog) {
        addToast(
          "Part deleted, but activity log failed. Run migration supabase/09_logs_program.sql or check the console.",
          "error"
        );
      }
    }
  };

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
      setParts((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: p.quantity - delta } : p)));
      addToast("Failed to update quantity.", "error");
      return;
    }
    if (part) {
      const action = delta < 0 ? "take" : "add";
      const okLog = await logActivity({
        program: normalizeProgram(part.program),
        user_name: "Mentor",
        action,
        part_name: part.name,
        part_id: id,
        details: `${action === "take" ? "Took" : "Added"} ${Math.abs(delta)} × ${part.name}`,
      });
      void loadLogs();
      if (!okLog) {
        addToast(
          "Quantity updated, but activity log failed. Run migration supabase/09_logs_program.sql or check the console.",
          "error"
        );
      }
    }
  };

  // ── Access code handlers ───────────────────────────────────────────────────
  const handleClearActivityLog = async () => {
    if (typeof window === "undefined") return;
    const label = sectionProgram.toUpperCase();
    if (
      !window.confirm(
        `Delete all ${label} activity log entries? This cannot be undone. Other programs are not affected.`
      )
    ) {
      return;
    }
    setLogsLoading(true);
    const { error } = await deleteLogsForProgram(sectionProgram);
    setLogsLoading(false);
    if (error) {
      addToast(error, "error");
      return;
    }
    setLogs([]);
    addToast(`${label} activity log cleared.`);
  };

  const handleGenerateCode = async () => {
    setCodeError("");
    const code = generateCode();
    setGeneratedCode(code);
    const { data, error } = await insertAccessCode(code, newCodeLabel.trim());
    if (error) {
      setCodeError(error);
      setGeneratedCode(null);
    } else if (data) {
      setAccessCodes((prev) => [data, ...prev]);
      setNewCodeLabel("");
      addToast(`Code ${code} created.`);
    }
  };

  const handleDeleteCode = async (id: string) => {
    setAccessCodes((prev) => prev.filter((c) => c.id !== id));
    const { error } = await deleteAccessCode(id);
    if (error) {
      addToast("Failed to delete code.", "error");
      loadCodes();
    }
  };

  // ── Vendor handlers ───────────────────────────────────────────────────────
  const handleSaveVendor = async () => {
    setVendorError("");
    const name = vendorForm.name.trim();
    const base_url = vendorForm.base_url.trim();
    if (!name || !base_url) {
      setVendorError("Both Name and Base URL are required.");
      return;
    }
    if (editingVendor) {
      const { error } = await updateVendor(editingVendor.id, name, base_url);
      if (error) { setVendorError(error); return; }
      setVendors((prev) => prev.map((v) => v.id === editingVendor.id ? { ...v, name, base_url } : v));
      addToast(`${name} updated.`);
    } else {
      const { data, error } = await insertVendor(name, base_url);
      if (error || !data) { setVendorError(error ?? "Failed to add vendor."); return; }
      setVendors((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      addToast(`${name} added.`);
    }
    setVendorForm({ name: "", base_url: "" });
    setEditingVendor(null);
  };

  const handleDeleteVendor = async (id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
    const { error } = await deleteVendor(id);
    if (error) { addToast("Failed to delete vendor.", "error"); loadVendors(); }
  };

  const startEditVendor = (v: Vendor) => {
    setEditingVendor(v);
    setVendorForm({ name: v.name, base_url: v.base_url });
    setVendorError("");
  };

  if (!sessionHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black border-b border-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow">
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-white leading-tight text-base">Robotics Inventory</h1>
              <p className="text-xs text-gray-400 leading-tight">
                Admin ·{" "}
                <span className="font-semibold text-gray-300 uppercase">{sectionProgram}</span> section
              </p>
            </div>
          </div>

          {/* Tab nav */}
          <nav className="ml-6 hidden sm:flex items-center gap-1">
            {(["inventory", "logs", "codes", "vendors"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
                  activeTab === tab
                    ? "bg-white text-black"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {tab === "inventory" ? "📦 Inventory" : tab === "logs" ? "📋 Activity Log" : tab === "codes" ? "🔑 Access Codes" : "🏪 Vendors"}
              </button>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-0.5 ml-2 lg:ml-4 shrink-0 rounded-lg bg-gray-900 border border-gray-700 p-0.5">
            <Link
              href="/admin/frc"
              prefetch
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                sectionProgram === "frc"
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              FRC
            </Link>
            <Link
              href="/admin/ftc"
              prefetch
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                sectionProgram === "ftc"
                  ? "bg-orange-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              FTC
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                sectionProgram === "ftc"
                  ? "bg-orange-500/20 text-orange-200 border-orange-400/40"
                  : "bg-white/10 text-gray-200 border-white/20"
              }`}
            >
              {sectionProgram}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-900/40 border border-amber-700/50 px-3 py-1.5 rounded-full font-medium">
              🔑 Mentor
            </span>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="text-xs text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
            <Image src="/itkan-logo.png" alt="ITKAN" width={36} height={36} className="invert opacity-80" />
          </div>
        </div>

        {/* Mobile tab bar */}
        <div className="sm:hidden flex flex-col border-t border-gray-800">
          <div className="flex border-b border-gray-800/80">
            <Link
              href="/admin/frc"
              className={`flex-1 py-2 text-center text-[10px] font-bold uppercase ${
                sectionProgram === "frc" ? "bg-white text-black" : "text-gray-400"
              }`}
            >
              FRC
            </Link>
            <Link
              href="/admin/ftc"
              className={`flex-1 py-2 text-center text-[10px] font-bold uppercase ${
                sectionProgram === "ftc" ? "bg-orange-500 text-white" : "text-gray-400"
              }`}
            >
              FTC
            </Link>
          </div>
          <div className="flex">
            {(["inventory", "logs", "codes", "vendors"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === tab ? "bg-gray-900 text-white" : "text-gray-400"
                }`}
              >
                {tab === "inventory" ? "📦 Inventory" : tab === "logs" ? "📋 Logs" : tab === "codes" ? "🔑 Codes" : "🏪 Vendors"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── INVENTORY TAB ── */}
        {activeTab === "inventory" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Parts" value={stats.totalParts} icon="🗂️" color="bg-gray-100 text-gray-700" />
              <StatCard label="Total Items" value={stats.totalItems} icon="📦" color="bg-gray-100 text-gray-700" />
              <StatCard label="Low Stock" value={stats.lowStock.length} icon="⚠️"
                color={stats.lowStock.length > 0 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"} />
              <div className="rounded-2xl bg-black p-4 flex flex-col justify-between">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-400 block">Export inventory</span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    {sectionProgram} only
                  </span>
                </div>
                <button
                  onClick={() =>
                    exportInventoryCSV(parts, drawers, sectionProgram)
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-black text-xs font-bold rounded-xl transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  CSV Export
                </button>
              </div>
            </div>

            {/* Low stock alerts */}
            {stats.lowStock.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-3">⚠ Low Stock Alerts</p>
                <div className="flex flex-wrap gap-2">
                  {stats.lowStock.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold rounded-full">
                      {p.name}
                      <span className="bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded-md text-xs font-bold">{p.quantity}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <BomAnalysis
              parts={parts}
              drawers={drawers}
              programSlug={sectionProgram}
            />

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  placeholder="Search by part number (SKU), name, company, category, or drawer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black shadow-sm transition"
                />
              </div>
              <button
                onClick={() => { setEditPart(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add New Part
              </button>
              <button
                onClick={() => setIsDrawerModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
                Drawers
              </button>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                Sections
              </button>
            </div>

            {/* Section / category chips */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {sectionFilterChips.map((cat) => (
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
                        canEdit={true}
                        onEdit={(p) => { setEditPart(p); setIsModalOpen(true); }}
                        onDelete={handleDelete}
                        onAdjustQuantity={handleAdjustQuantity}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-3xl">🔍</div>
                    <h3 className="font-semibold text-slate-700 mb-1">No parts found</h3>
                    <p className="text-sm text-slate-400 max-w-xs">Try adjusting your search or add a new part.</p>
                    <button
                      onClick={() => { setEditPart(null); setIsModalOpen(true); }}
                      className="mt-5 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Add New Part
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── ACTIVITY LOG TAB ── */}
        {activeTab === "logs" && (
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Activity Log</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Changes for{" "}
                  <span
                    className={`font-bold uppercase tracking-wide ${
                      sectionProgram === "ftc" ? "text-orange-600" : "text-slate-700"
                    }`}
                  >
                    {sectionProgram}
                  </span>{" "}
                  inventory only (separate from the other program).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportActivityLogCSV(logs, sectionProgram)}
                  disabled={logs.length === 0 || logsLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-black text-white hover:bg-gray-900 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export log CSV
                </button>
                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={logsLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleClearActivityLog}
                  disabled={logsLoading || logs.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  Clear log
                </button>
              </div>
            </div>

            {logsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-500 font-medium">No activity yet</p>
                <p className="text-slate-400 text-sm mt-1">Actions will appear here once students or mentors use the inventory.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Part</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{timeAgo(log.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {log.user_name === "Mentor" ? "🔑" : "🎓"} {log.user_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-medium hidden sm:table-cell">{log.part_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{logDetailsCell(log.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ACCESS CODES TAB ── */}
        {activeTab === "codes" && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-800">Access Codes</h2>
              <p className="text-sm text-slate-500 mt-0.5">Generate and manage 6-digit mentor access codes.</p>
            </div>

            {/* Generate new code */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Generate New Code</h3>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  placeholder="Label (optional, e.g. 'Coach Smith')"
                  value={newCodeLabel}
                  onChange={(e) => { setNewCodeLabel(e.target.value); setCodeError(""); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {codeError && <p className="text-xs text-red-500">{codeError}</p>}
                {generatedCode && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <span className="text-green-700 text-xs font-medium">New code created:</span>
                    <span className="font-mono text-2xl font-bold text-green-800 tracking-[0.4em]">{generatedCode}</span>
                  </div>
                )}
                <button
                  onClick={handleGenerateCode}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Generate Code
                </button>
              </div>
            </div>

            {/* Existing codes list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Active Codes</h3>
                <button
                  onClick={loadCodes}
                  disabled={codesLoading}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {codesLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              {codesLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : accessCodes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-sm">No access codes yet. Generate one above.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {accessCodes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xl font-bold text-slate-800 tracking-[0.3em]">{c.code}</span>
                        {c.label && <span className="text-sm text-slate-500">{c.label}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                        <button
                          onClick={() => handleDeleteCode(c.id)}
                          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors font-medium"
                        >
                          Revoke
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── VENDORS TAB ── */}
        {activeTab === "vendors" && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800">Vendor Management</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage vendor names and base URLs. These appear as options in the Add Part modal so students can quickly find product images.
              </p>
            </div>

            {/* Add / Edit form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">
                {editingVendor ? `Editing: ${editingVendor.name}` : "Add New Vendor"}
              </h3>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-600">Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. REV Robotics"
                      value={vendorForm.name}
                      onChange={(e) => { setVendorForm({ ...vendorForm, name: e.target.value }); setVendorError(""); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-600">Base URL</label>
                    <input
                      type="url"
                      placeholder="https://www.revrobotics.com"
                      value={vendorForm.base_url}
                      onChange={(e) => { setVendorForm({ ...vendorForm, base_url: e.target.value }); setVendorError(""); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    />
                  </div>
                </div>
                {vendorError && <p className="text-xs text-red-500">{vendorError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveVendor}
                    className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {editingVendor ? "Save Changes" : "Add Vendor"}
                  </button>
                  {editingVendor && (
                    <button
                      onClick={() => { setEditingVendor(null); setVendorForm({ name: "", base_url: "" }); setVendorError(""); }}
                      className="px-5 py-2.5 border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Vendors list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                  Vendors ({vendors.length})
                </h3>
                <button
                  onClick={loadVendors}
                  disabled={vendorsLoading}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {vendorsLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              {vendorsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : vendors.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  No vendors yet. Add one above.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {vendors.map((v) => (
                    <li key={v.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{v.name}</p>
                        <a
                          href={v.base_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-slate-600 underline truncate block"
                        >
                          {v.base_url}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEditVendor(v)}
                          className="text-xs text-slate-500 hover:text-black hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(v.id)}
                          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <PartModal
        key={isModalOpen ? (editPart?.id ?? "new") : "closed"}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditPart(null);
        }}
        onSave={handleSave}
        editPart={editPart}
        drawers={drawers}
        categoryOptions={categoryLabels}
        vendors={vendors}
        inventoryProgram={sectionProgram}
        allowProgramEdit={!!editPart}
        existingParts={parts}
      />
      <DrawerModal
        isOpen={isDrawerModalOpen}
        onClose={() => setIsDrawerModalOpen(false)}
        drawers={drawers}
        onDrawersChange={setDrawers}
      />
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        parts={parts}
        onCategoriesChange={setCategories}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
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

const ACTION_STYLES: Record<string, string> = {
  take: "bg-orange-100 text-orange-700",
  add: "bg-green-100 text-green-700",
  add_part: "bg-blue-100 text-blue-700",
  edit_part: "bg-purple-100 text-purple-700",
  delete_part: "bg-red-100 text-red-700",
};

function ActionBadge({ action }: { action: string }) {
  const label = action.replace("_", " ");
  const style = ACTION_STYLES[action] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${style}`}>
      {label}
    </span>
  );
}

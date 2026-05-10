import { createClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
import { AccessCode, Drawer, Log, Part, PartCategory, Program, Vendor } from "./types";

export function normalizeProgram(value: string | null | undefined): Program {
  if (value == null || typeof value !== "string") return "frc";
  const v = value.trim().toLowerCase();
  return v === "ftc" ? "ftc" : "frc";
}

function formatSupabaseError(error: PostgrestError): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(" — ");
}

/** User-facing hint when DB lacks migration 12 or PostgREST cache is stale. */
function hintPartsSkuColumnsMissing(error: PostgrestError): string | null {
  const raw = formatSupabaseError(error);
  const m = raw.toLowerCase();
  const cacheIssue =
    error.code === "PGRST204" ||
    m.includes("schema cache") ||
    m.includes("could not find");
  if (!cacheIssue) return null;
  if (m.includes("part_number") || m.includes("vendor_url")) {
    return [
      "Your Supabase database needs the latest parts columns.",
      'Open Supabase → SQL Editor, run the script in supabase/12_parts_part_number_vendor_url.sql (it ends with NOTIFY to refresh the API).',
      "If it still fails: Dashboard → Settings → API → reload schema, or wait a minute and retry.",
    ].join(" ");
  }
  return null;
}

/** True when DB/schema does not have `logs.program` yet (migration 09 not applied). */
function isLogsProgramColumnMissingError(error: PostgrestError): boolean {
  const msg = formatSupabaseError(error).toLowerCase();
  if (error.code === "42703") return true;
  if (error.code === "PGRST204" && msg.includes("program")) return true;
  if (msg.includes("schema cache") && msg.includes("program")) return true;
  if (
    msg.includes("program") &&
    (msg.includes("does not exist") ||
      msg.includes("unknown column") ||
      msg.includes("could not find the"))
  ) {
    return true;
  }
  return false;
}

/** When `logs.program` column is missing, we prefix details with `[frc]` / `[ftc]`. */
function parseProgramFromBracketDetails(
  details: string | null | undefined
): Program | null {
  if (!details || typeof details !== "string") return null;
  const m = details.match(/^\[(frc|ftc)\]\s*/i);
  if (!m) return null;
  return m[1].toLowerCase() === "ftc" ? "ftc" : "frc";
}

/** Never mix programs in the UI: filter after fetch (fixes legacy unscoped queries). */
function filterLogsByProgram(rows: Log[], program: Program): Log[] {
  return rows.filter((log) => log.program === program);
}

/**
 * Vercel / CI runs `next build` without `.env.local`. Supabase's client throws if the
 * URL is missing, which fails static generation. Placeholders let the build finish;
 * set env vars on the host — API calls will not work until real values are present.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://build-placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "build-placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
});

// Raw DB row shape (snake_case column names)
interface DbPart {
  id: string;
  part_number?: string | null;
  name: string;
  company?: string | null;
  program?: string | null;
  category: string;
  quantity: number;
  drawer_id: string;
  image_url: string;
  description: string;
  min_quantity: number;
  vendor_url?: string | null;
}

function mapDbPart(row: DbPart): Part {
  return {
    id: row.id,
    partNumber: row.part_number ?? "",
    name: row.name,
    company: row.company ?? "",
    program: normalizeProgram(row.program),
    category: row.category,
    quantity: row.quantity,
    drawerId: row.drawer_id,
    imageUrl: row.image_url,
    description: row.description,
    minQuantity: row.min_quantity,
    vendorUrl: row.vendor_url ?? "",
  };
}

function partToDb(part: Omit<Part, "id">): Omit<DbPart, "id"> {
  return {
    part_number: part.partNumber.trim(),
    name: part.name,
    company: part.company.trim() || "",
    program: part.program,
    category: part.category,
    quantity: part.quantity,
    drawer_id: part.drawerId,
    image_url: part.imageUrl,
    description: part.description,
    min_quantity: part.minQuantity,
    vendor_url: part.vendorUrl.trim(),
  };
}

export async function fetchParts(program: Program): Promise<Part[] | null> {
  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .eq("program", program)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetchParts error:", error.message);
    return null;
  }
  return (data as DbPart[]).map(mapDbPart);
}

/** Insert a new part and return the persisted record (with DB-assigned id). */
export async function insertPart(
  part: Omit<Part, "id">
): Promise<{ data: Part | null; error: string | null }> {
  const { data, error } = await supabase
    .from("parts")
    .insert(partToDb(part))
    .select()
    .single();

  if (error) {
    console.error("Supabase insertPart error:", formatSupabaseError(error));
    const hint = hintPartsSkuColumnsMissing(error);
    return { data: null, error: hint ?? formatSupabaseError(error) };
  }
  return { data: mapDbPart(data as DbPart), error: null };
}

/** Replace all editable fields on an existing part. */
export async function updatePart(
  id: string,
  part: Omit<Part, "id">
): Promise<boolean> {
  const { error } = await supabase
    .from("parts")
    .update(partToDb(part))
    .eq("id", id);

  if (error) {
    console.error("Supabase updatePart error:", error.message);
    return false;
  }
  return true;
}

/** Lightweight quantity-only update used by the +/- controls. */
export async function updatePartQuantity(
  id: string,
  newQuantity: number
): Promise<boolean> {
  const { error } = await supabase
    .from("parts")
    .update({ quantity: newQuantity })
    .eq("id", id);

  if (error) {
    console.error("Supabase updatePartQuantity error:", error.message);
    return false;
  }
  return true;
}

/** Permanently delete a part by id. */
export async function deletePart(id: string): Promise<boolean> {
  const { error } = await supabase.from("parts").delete().eq("id", id);

  if (error) {
    console.error("Supabase deletePart error:", error.message);
    return false;
  }
  return true;
}

/** Fetch all drawers ordered by label. */
export async function fetchDrawers(): Promise<Drawer[] | null> {
  const { data, error } = await supabase
    .from("drawers")
    .select("id, label")
    .order("label", { ascending: true });

  if (error) {
    console.error("Supabase fetchDrawers error:", error.message);
    return null;
  }
  return data as Drawer[];
}

/** Insert a new drawer and return the persisted record. */
export async function insertDrawer(
  label: string
): Promise<{ data: Drawer | null; error: string | null }> {
  const { data, error } = await supabase
    .from("drawers")
    .insert({ label })
    .select("id, label")
    .single();

  if (error) {
    console.error("Supabase insertDrawer error:", error.message);
    return { data: null, error: error.message };
  }
  return { data: data as Drawer, error: null };
}

/** Delete a drawer by id. */
export async function deleteDrawer(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("drawers").delete().eq("id", id);

  if (error) {
    console.error("Supabase deleteDrawer error:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Fetch all part categories ordered by label. */
export async function fetchCategories(): Promise<PartCategory[] | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, label")
    .order("label", { ascending: true });

  if (error) {
    console.error("Supabase fetchCategories error:", error.message);
    return null;
  }
  return data as PartCategory[];
}

/** Insert a new category and return the persisted record. */
export async function insertCategory(
  label: string
): Promise<{ data: PartCategory | null; error: string | null }> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ label })
    .select("id, label")
    .single();

  if (error) {
    console.error("Supabase insertCategory error:", error.message);
    return { data: null, error: error.message };
  }
  return { data: data as PartCategory, error: null };
}

/** Delete a category by id. */
export async function deleteCategory(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    console.error("Supabase deleteCategory error:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

// ── Activity Logs ──────────────────────────────────────────────────────────

/** Log an activity. Returns false if the insert failed (e.g. schema / RLS). */
export async function logActivity(
  entry: Omit<Log, "id" | "created_at">
): Promise<boolean> {
  const prog = normalizeProgram(entry.program);
  const row = {
    program: prog,
    user_name: entry.user_name,
    action: entry.action,
    part_name: entry.part_name,
    part_id: entry.part_id ?? null,
    details: entry.details ?? null,
  };
  let { error } = await supabase.from("logs").insert(row);
  if (error && isLogsProgramColumnMissingError(error)) {
    const { program: _p, ...rest } = row;
    const tag = `[${prog}]`;
    const legacyDetails =
      rest.details && rest.details.trim()
        ? `${tag} ${rest.details}`
        : tag;
    ({ error } = await supabase.from("logs").insert({
      ...rest,
      details: legacyDetails,
    }));
  }
  if (error) {
    console.error("Supabase logActivity error:", formatSupabaseError(error));
    return false;
  }
  return true;
}

interface DbLogRow {
  id: string;
  created_at: string;
  program?: string | null;
  user_name: string;
  action: string;
  part_name: string;
  part_id: string | null;
  details: string | null;
}

function mapDbLog(row: DbLogRow): Log {
  const col = row.program;
  let program: Program;
  if (col != null && String(col).trim() !== "") {
    program = normalizeProgram(col);
  } else {
    program = parseProgramFromBracketDetails(row.details) ?? "frc";
  }
  return {
    id: row.id,
    created_at: row.created_at,
    program,
    user_name: row.user_name,
    action: row.action,
    part_name: row.part_name,
    part_id: row.part_id,
    details: row.details,
  };
}

/** Fetch the 200 most-recent activity logs for one FIRST program. */
export async function fetchLogs(program: Program): Promise<Log[] | null> {
  const scoped = await supabase
    .from("logs")
    .select("*")
    .eq("program", program)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!scoped.error) {
    const rows = (scoped.data as DbLogRow[]).map(mapDbLog);
    return filterLogsByProgram(rows, program).slice(0, 200);
  }

  if (isLogsProgramColumnMissingError(scoped.error)) {
    const legacy = await supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (legacy.error) {
      console.error("Supabase fetchLogs error:", formatSupabaseError(legacy.error));
      return null;
    }
    const rows = (legacy.data as DbLogRow[]).map(mapDbLog);
    return filterLogsByProgram(rows, program).slice(0, 200);
  }

  console.error("Supabase fetchLogs error:", formatSupabaseError(scoped.error));
  return null;
}

/** Delete all activity log rows for one program (column `program` and/or legacy `[frc]` / `[ftc]` details prefix). */
export async function deleteLogsForProgram(
  program: Program
): Promise<{ error: string | null }> {
  const likePattern = `[${program}]%`;

  const eqDelete = await supabase.from("logs").delete().eq("program", program);
  if (!eqDelete.error) {
    const legacyWipe = await supabase.from("logs").delete().like("details", likePattern);
    if (legacyWipe.error) {
      return { error: formatSupabaseError(legacyWipe.error) };
    }
    return { error: null };
  }

  if (isLogsProgramColumnMissingError(eqDelete.error)) {
    const legacy = await supabase.from("logs").delete().like("details", likePattern);
    if (legacy.error) {
      return { error: formatSupabaseError(legacy.error) };
    }
    return { error: null };
  }

  return { error: formatSupabaseError(eqDelete.error) };
}

// ── Access Codes ───────────────────────────────────────────────────────────

/** Always accepted for mentor login (built-in master code). Change or remove for stricter access. */
const MASTER_MENTOR_CODES = new Set(["111111"]);

/** Returns true if the code exists in the access_codes table. */
export async function validateAccessCode(code: string): Promise<boolean> {
  if (MASTER_MENTOR_CODES.has(code)) return true;
  const { data, error } = await supabase
    .from("access_codes")
    .select("id")
    .eq("code", code)
    .single();
  if (error) return false;
  return !!data;
}

/** Fetch all access codes (newest first). */
export async function fetchAccessCodes(): Promise<AccessCode[] | null> {
  const { data, error } = await supabase
    .from("access_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetchAccessCodes error:", error.message);
    return null;
  }
  return data as AccessCode[];
}

/** Insert a new access code. */
export async function insertAccessCode(
  code: string,
  label: string
): Promise<{ data: AccessCode | null; error: string | null }> {
  const { data, error } = await supabase
    .from("access_codes")
    .insert({ code, label })
    .select()
    .single();

  if (error) {
    console.error("Supabase insertAccessCode error:", error.message);
    return { data: null, error: error.message };
  }
  return { data: data as AccessCode, error: null };
}

/** Delete an access code by id. */
export async function deleteAccessCode(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("access_codes").delete().eq("id", id);

  if (error) {
    console.error("Supabase deleteAccessCode error:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

// ── Vendors ──────────────────────────────────────────────────────────────────

/** Fetch all vendors ordered by name. */
export async function fetchVendors(): Promise<Vendor[] | null> {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase fetchVendors error:", error.message);
    return null;
  }
  return data as Vendor[];
}

/** Insert a new vendor. */
export async function insertVendor(
  name: string,
  base_url: string
): Promise<{ data: Vendor | null; error: string | null }> {
  const { data, error } = await supabase
    .from("vendors")
    .insert({ name, base_url })
    .select()
    .single();

  if (error) {
    console.error("Supabase insertVendor error:", error.message);
    return { data: null, error: error.message };
  }
  return { data: data as Vendor, error: null };
}

/** Update an existing vendor. */
export async function updateVendor(
  id: string,
  name: string,
  base_url: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("vendors")
    .update({ name, base_url })
    .eq("id", id);

  if (error) {
    console.error("Supabase updateVendor error:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Delete a vendor by id. */
export async function deleteVendor(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("vendors").delete().eq("id", id);

  if (error) {
    console.error("Supabase deleteVendor error:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

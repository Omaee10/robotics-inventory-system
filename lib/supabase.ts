import { createClient } from "@supabase/supabase-js";
import { AccessCode, Drawer, Log, Part, Vendor } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  name: string;
  company?: string | null;
  category: string;
  quantity: number;
  drawer_id: string;
  image_url: string;
  description: string;
  min_quantity: number;
}

function mapDbPart(row: DbPart): Part {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? "",
    category: row.category,
    quantity: row.quantity,
    drawerId: row.drawer_id,
    imageUrl: row.image_url,
    description: row.description,
    minQuantity: row.min_quantity,
  };
}

function partToDb(part: Omit<Part, "id">): Omit<DbPart, "id"> {
  return {
    name: part.name,
    company: part.company.trim() || "",
    category: part.category,
    quantity: part.quantity,
    drawer_id: part.drawerId,
    image_url: part.imageUrl,
    description: part.description,
    min_quantity: part.minQuantity,
  };
}

export async function fetchParts(): Promise<Part[] | null> {
  const { data, error } = await supabase
    .from("parts")
    .select("*")
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
    console.error("Supabase insertPart error:", error.message);
    return { data: null, error: error.message };
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

// ── Activity Logs ──────────────────────────────────────────────────────────

/** Log an activity (fire-and-forget; errors are silent so they never block UI). */
export async function logActivity(
  entry: Omit<Log, "id" | "created_at">
): Promise<void> {
  const { error } = await supabase.from("logs").insert({
    user_name: entry.user_name,
    action: entry.action,
    part_name: entry.part_name,
    part_id: entry.part_id ?? null,
    details: entry.details ?? null,
  });
  if (error) console.error("Supabase logActivity error:", error.message);
}

/** Fetch the 200 most-recent activity logs. */
export async function fetchLogs(): Promise<Log[] | null> {
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Supabase fetchLogs error:", error.message);
    return null;
  }
  return data as Log[];
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

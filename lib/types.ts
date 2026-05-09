export interface Part {
  id: string;
  name: string;
  /** Supplier / vendor name (e.g. REV Robotics). */
  company: string;
  category: string;
  quantity: number;
  drawerId: string;
  imageUrl: string;
  description: string;
  minQuantity: number;
}

export interface Drawer {
  id: string;
  label: string;
}

export interface AccessCode {
  id: string;
  code: string;
  label: string;
  created_at: string;
}

export interface Log {
  id: string;
  created_at: string;
  user_name: string;
  action: string;
  part_name: string;
  part_id: string | null;
  details: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  base_url: string;
  created_at: string;
}

export type UserRole = "student" | "mentor";

export interface UserSession {
  role: UserRole;
  name: string;
}

/** Result of saving a part from PartModal (inline + toast messaging). */
export type PartSaveResult =
  | { ok: true }
  | { ok: false; error: string };

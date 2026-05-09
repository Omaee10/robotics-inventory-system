export interface Part {
  id: string;
  name: string;
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

export type UserRole = "student" | "mentor";

export interface UserSession {
  role: UserRole;
  name: string;
}

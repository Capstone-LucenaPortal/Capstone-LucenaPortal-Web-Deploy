export type Module = "yellow-card" | "incidents" | "booking";

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: "staff" | "admin";
  department: string;
  assignedModules: Module[];
  is_supervisor?: boolean;
  created_at: string;
}

export interface AuthSession {
  user: StaffUser;
  access_token: string;
}

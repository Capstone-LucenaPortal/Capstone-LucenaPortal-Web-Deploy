// Domain types for the accounts feature.
export type Role = "Staff" | "Responder" | "Admin" | "Super Staff";
export type Module = "Yellow Card" | "Incidents" | "Booking";
export type AccountStatus = "Active" | "Inactive";

export type Account = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** Assigned service modules; only meaningful for Staff. */
  modules: Module[];
  /** Incident force-release flag; only meaningful for Staff with the Incidents module. */
  isSupervisor: boolean;
  status: AccountStatus;
  createdAt: string; // ISO
  lastChangeAt: string; // ISO
  /** Responder-only. */
  departmentCode?: string;
  /** Responder-only, human-readable. */
  departmentLabel?: string;
  /** Responder-only. */
  phone?: string;
  /** Responder-only. */
  employeeId?: string;
  /** Set when the account was created by invite. ISO, or null. */
  invitedAt: string | null;
  /**
   * Set when the invite LINK WAS CLICKED — not when setup completed.
   * Never present this as "setup complete"; that state is not observable.
   */
  lastSignInAt: string | null;
};

export type NewAccountInput = {
  fullName: string;
  email: string;
  role: Role;
  modules: Module[];
  isSupervisor: boolean;
  /** Responder-only. Required by the DB for role='responder'. */
  departmentCode?: string;
  /** Responder-only. Required by the DB for role='responder'. */
  phone?: string;
  /** Responder-only. Required by the DB for role='responder'. */
  employeeId?: string;
};

export type AccountPatch = Partial<Omit<Account, "id" | "createdAt">>;

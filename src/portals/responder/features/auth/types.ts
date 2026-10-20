// The signed-in responder, as every surface in this app sees them. Mapped from
// the my_staff_profile view by lib/responder-user.ts — see the persona PRD §3.

export interface ResponderUser {
  id: string;
  email: string;
  full_name: string;
  role: "responder";
  /** Exactly one department — scopes the pool, the Inbox, and claims. */
  department_code: string;
  /** The department's human name, e.g. "Engineering". Rendered, never matched. */
  department_label: string;
  phone: string;
  employee_id: string;
  /** Self-toggled; defaults false. The department's headcount; never hides work. */
  on_duty: boolean;
  created_at: string;
}

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Select } from "@/portals/super-staff/components/ui/select";
import { createClient } from "@/shared/supabase/client";
import type { FieldErrors } from "../lib/validation";
import type { Module, Role } from "../types";

export type AccountFormValue = {
  fullName: string;
  email: string;
  role: Role;
  modules: Module[];
  isSupervisor: boolean;
  departmentCode?: string;
  phone?: string;
  employeeId?: string;
};

const ROLES: Role[] = ["Staff", "Responder", "Admin", "Super Staff"];
const MODULES: Module[] = ["Yellow Card", "Incidents", "Booking"];

export function AccountFormFields({
  value,
  errors,
  onChange,
  emailReadOnly = false,
}: {
  value: AccountFormValue;
  errors: FieldErrors;
  onChange: (next: AccountFormValue) => void;
  /**
   * Set on the edit screen. update_staff_account has no p_email parameter, so
   * a typed-in address would be silently discarded — and it is that missing
   * parameter which stops a Super Staff repointing someone else's sign-in
   * link at a mailbox they control. Showing it as editable would be a lie.
   */
  emailReadOnly?: boolean;
}) {
  const set = (patch: Partial<AccountFormValue>) =>
    onChange({ ...value, ...patch });

  const toggleModule = (m: Module) => {
    const has = value.modules.includes(m);
    const modules = has
      ? value.modules.filter((x) => x !== m)
      : [...value.modules, m];
    // Dropping Incidents also clears the incident-only supervisor flag.
    const isSupervisor = m === "Incidents" && has ? false : value.isSupervisor;
    set({ modules, isSupervisor });
  };

  const incidentsOn = value.modules.includes("Incidents");

  // `departments` is a revoked base table under PL-12 — public_departments is
  // the readable surface.
  const [departments, setDepartments] = useState<
    { code: string; label: string }[]
  >([]);

  useEffect(() => {
    if (value.role !== "Responder") return;
    void createClient()
      .from("public_departments")
      .select("code, label")
      .order("sort_order")
      .then(({ data }) => {
        setDepartments(
          (data ?? [])
            .filter((d): d is { code: string; label: string } =>
              Boolean(d.code && d.label),
            )
            .map((d) => ({ code: d.code, label: d.label })),
        );
      });
  }, [value.role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-sm font-medium text-gray-900">
          Full name
        </label>
        <Input
          id="fullName"
          value={value.fullName}
          error={errors.fullName}
          onChange={(e) => set({ fullName: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-900">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={value.email}
          error={errors.email}
          readOnly={emailReadOnly}
          className={emailReadOnly ? "bg-gray-50 text-gray-500" : undefined}
          onChange={(e) => set({ email: e.target.value })}
        />
        {emailReadOnly && (
          <p className="text-xs text-gray-500">
            An email address cannot be changed here.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-gray-900">
          Role
        </label>
        <Select
          id="role"
          value={value.role}
          onChange={(e) =>
            set(
              e.target.value === "Staff"
                ? {
                    role: "Staff",
                    departmentCode: undefined,
                    phone: undefined,
                    employeeId: undefined,
                  }
                : e.target.value === "Responder"
                  ? { role: "Responder", modules: [], isSupervisor: false }
                  : // non-staff carries no modules/supervisor
                    {
                      role: e.target.value as Role,
                      modules: [],
                      isSupervisor: false,
                      departmentCode: undefined,
                      phone: undefined,
                      employeeId: undefined,
                    },
            )
          }
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>

      {value.role === "Staff" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-900">
              Assigned modules
            </span>
            <div className="flex flex-wrap gap-4">
              {MODULES.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={value.modules.includes(m)}
                    onChange={() => toggleModule(m)}
                    className="h-4 w-4 accent-lucena-blue"
                  />
                  {m}
                </label>
              ))}
            </div>
            {errors.modules && (
              <p className="text-xs text-red-500">{errors.modules}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={value.isSupervisor}
                disabled={!incidentsOn}
                onChange={(e) => set({ isSupervisor: e.target.checked })}
                className="h-4 w-4 accent-lucena-blue disabled:opacity-50"
              />
              Supervisor (force-release on incidents)
            </label>
            <p className="text-xs text-gray-500">Requires the Incidents module.</p>
            {errors.supervisor && (
              <p className="text-xs text-red-500">{errors.supervisor}</p>
            )}
          </div>
        </>
      )}

      {value.role === "Responder" && (
        <>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="departmentCode"
              className="text-sm font-medium text-gray-900"
            >
              Department
            </label>
            <Select
              id="departmentCode"
              value={value.departmentCode ?? ""}
              onChange={(e) => set({ departmentCode: e.target.value })}
            >
              <option value="">Select a department…</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </Select>
            {errors.departmentCode && (
              <p className="text-xs text-red-500">{errors.departmentCode}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-medium text-gray-900">
              Phone
            </label>
            <Input
              id="phone"
              value={value.phone ?? ""}
              error={errors.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="employeeId"
              className="text-sm font-medium text-gray-900"
            >
              Employee ID
            </label>
            <Input
              id="employeeId"
              value={value.employeeId ?? ""}
              error={errors.employeeId}
              onChange={(e) => set({ employeeId: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

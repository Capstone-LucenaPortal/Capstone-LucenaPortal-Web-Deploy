const STEPS = ["Role", "Details", "Confirm"] as const;

/**
 * Decorative wayfinding header for the (single-page) create-account form —
 * echoes the EndUser numbered stepper. All steps render as filled lucena-blue
 * circles. This is NOT a wizard: no click handlers, no per-step form state.
 */
export function AccountStepper() {
  return (
    <ol aria-hidden="true" className="mt-6 flex items-center justify-between">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lucena-blue text-sm font-semibold text-white">
              {i + 1}
            </span>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <span className="mx-4 h-px flex-1 bg-gray-200" />
          )}
        </li>
      ))}
    </ol>
  );
}

// src/portals/admin/components/ui/skeleton.tsx
//
// Minimal loading placeholder (Admin Portal Fix Plan, Task 4.3). Used in two
// places across the five admin pages: in place of a KPI number/note/caption
// while a fetch is in flight (so a tile never shows a real-looking-but-fake
// `0`/`—` before its first successful load), and in place of a text-only
// "Loading…" message for a section whose real content is a fixed-height
// block (a table, a chart), so the layout does not shift when the fetch
// resolves.
//
// Deliberately not a variant/size prop system: every one of this codebase's
// five consumers just needs a differently-sized rectangle, which Tailwind's
// own h-*/w-* utilities already cover via `className` — there is nothing
// else the five call sites vary on. `inline-block` (not `block`/`div`'s
// default) so a Skeleton can drop into an inline text spot (a KPI value,
// a note line) as well as a standalone block one.
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-pulse rounded-none bg-gray-200 ${className}`} />;
}

// The accessible half of a loading state (Admin Portal Fix Plan, Task 4.3
// review fix). Skeleton above is `aria-hidden` — it is a purely visual
// placeholder — so a page that shows nothing but Skeleton blocks while
// loading gives a screen reader user zero signal that anything is
// happening, a real regression against the plain "Loading…" DOM text this
// task replaced (a reading cursor passing over that text would announce
// it). `role="status"` is a polite live region: read out once when it
// appears, without interrupting whatever the user is currently doing —
// the right strength for a one-shot "this section is loading" cue, and the
// more conventional choice for this exact case over a bare
// `aria-live="polite"` div. `sr-only` (a standard Tailwind utility, no
// project config needed) keeps it out of the visual layout entirely —
// sighted users already see the Skeleton blocks themselves.
//
// One of these per independently-loading page region is enough — not one
// per individual `<Skeleton/>` instance, which would fire a flood of
// identical announcements for, say, four KPI tiles that all start and
// finish loading together.
export function LoadingStatus({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

export function ImpactNote({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <div className="mt-3 flex gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
      <span aria-hidden>&#9432;</span>
      <p>{children}</p>
    </div>
  );
}

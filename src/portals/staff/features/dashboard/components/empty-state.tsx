export function DashboardEmptyState() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-gray-900 font-medium">No module assigned yet.</p>
      <p className="text-gray-500 text-sm mt-1">
        Contact your administrator to get access to a module.
      </p>
    </div>
  );
}

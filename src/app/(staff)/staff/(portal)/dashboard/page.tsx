import { getCurrentStaffUser } from "@/portals/staff/features/auth/lib/session";
import { getDashboardCards } from "@/portals/staff/features/dashboard/lib/cards";
import { ModuleStatCard } from "@/portals/staff/features/dashboard/components/module-stat-card";
import { DashboardGreeting } from "@/portals/staff/features/dashboard/components/greeting";
import { DashboardEmptyState } from "@/portals/staff/features/dashboard/components/empty-state";

export default async function DashboardPage() {
  // This render-top's one clock, and the greeting's. Not the only one on the
  // screen: each module's card composer is the top of its own fan-out and makes
  // its own, and the footer's copyright year is exempt from the rule outright.
  const now = new Date();

  const user = await getCurrentStaffUser();
  const cards = await getDashboardCards(user.assignedModules);

  return (
    <div>
      <DashboardGreeting name={user.full_name} now={now} />
      {cards.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ModuleStatCard key={card.module} data={card} />
          ))}
        </div>
      )}
    </div>
  );
}

import { formatDate } from "@/portals/staff/lib/utils";

interface DashboardGreetingProps {
  name: string;
  /**
   * The moment this page was rendered at, handed down rather than read here.
   * A clock created in this component ticks after the one the cards below were
   * built from, so a dashboard opened across midnight could date its greeting
   * a day ahead of the work it is showing.
   */
  now: Date;
}

export function DashboardGreeting({ name, now }: DashboardGreetingProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-lucena-blue">Welcome back, {name}</h1>
      <p className="text-gray-500 mt-1">{formatDate(now)}</p>
    </div>
  );
}

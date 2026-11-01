import { notFound } from "next/navigation";
import { KitchenSink } from "@/portals/staff/components/kitchen-sink";

/**
 * A dev tool for checking the UI kit, never shipped: a production build
 * answers 404 here. The guard still runs first, so a signed-out visitor is
 * sent to login before reaching this.
 */
export default function KitchenSinkPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <KitchenSink />;
}

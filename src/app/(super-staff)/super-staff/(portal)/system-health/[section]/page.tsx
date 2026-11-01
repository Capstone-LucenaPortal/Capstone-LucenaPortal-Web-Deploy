import { notFound } from "next/navigation";
import { SectionView } from "@/portals/super-staff/features/system-health/components/section-view";
import { sectionFromSlug } from "@/portals/super-staff/features/system-health/lib/status";

/**
 * One System Health section. An unknown section is not a page: notFound()
 * renders Page not found inside the Super Staff shell, as an unknown
 * /super-staff address does (#30).
 */
export default async function SystemHealthSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const key = sectionFromSlug(section);
  if (key === null) notFound();
  return <SectionView section={key} />;
}

import { AnnouncementsListView } from "@/portals/super-staff/features/announcements/components/announcements-list-view";
import { CategoryManager } from "@/portals/super-staff/features/announcements/components/category-manager";

export default function AnnouncementsPage() {
  return (
    <>
      <AnnouncementsListView />
      <CategoryManager />
    </>
  );
}

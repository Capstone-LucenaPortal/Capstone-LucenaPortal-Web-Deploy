import { AccountDetailView } from "@/portals/super-staff/features/accounts/components/account-detail-view";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AccountDetailView id={id} />;
}

export const metadata = { title: "Profile · LucenaPortal Responder" };

/**
 * The profile page is a client component — photo picker, sheets, duty switch —
 * so it cannot export `metadata` itself. This layout carries the title so the
 * tab matches every other destination.
 */
export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { LogoutButton } from "@/portals/super-staff/components/layout/logout-button";

interface NavbarProps {
  user: { fullName: string };
}

export function Navbar({ user }: NavbarProps) {
  return (
    <header className="h-16 border-b-[3px] border-lucena-blue bg-white px-6 flex items-center justify-between shrink-0">
      <span className="text-sm font-medium text-gray-500">
        Super Staff Portal
      </span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">
          {user.fullName}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}

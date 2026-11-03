import { Home, MapPin, Users, UserCircle2, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

const navItems = [
  { label: "Home", url: "/dashboard", icon: Home },
  { label: "Districts", url: "/districts", icon: MapPin },
  { label: "Registers", url: "/households", icon: Users },
  { label: "Services", url: "/vca-services", icon: ClipboardList },
  { label: "Profile", url: "/profile", icon: UserCircle2 },
];

type MobileBottomNavProps = {
  onOpenMenu: () => void;
};

const MobileBottomNav = ({ onOpenMenu }: MobileBottomNavProps) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-lg sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.url}
            end
            className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500"
            activeClassName="text-slate-900"
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500">
            •••
          </div>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;

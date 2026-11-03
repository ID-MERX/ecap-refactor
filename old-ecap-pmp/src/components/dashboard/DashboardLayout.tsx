import { type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import {
  Archive,
  BarChart3,
  ClipboardList,
  Flag,
  HeartPulse,
  Home,
  MapPin,
  UserCircle2,
  UserCog,
  Users,
  Calendar,
} from "lucide-react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import GlowHeader from "@/components/aceternity/GlowHeader";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import { AiAssistant } from "@/components/dashboard/AiAssistant";
import { useCalendarNotifications } from "@/hooks/useCalendarNotifications";

type DashboardLayoutProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

const mobileMenuItems = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Districts", url: "/districts", icon: MapPin },
  { title: "Household Register", url: "/households", icon: Home },
  { title: "VCA Register", url: "/vcas", icon: Users },
  { title: "VCA Services", url: "/vca-services", icon: ClipboardList },
  { title: "Household Services", url: "/household-services", icon: HeartPulse },
  { title: "Flags", url: "/flags", icon: Flag },
  { title: "Household Archived Register", url: "/households/archived", icon: Archive },
  { title: "VCA Archived Register", url: "/vcas/archived", icon: Archive },
  { title: "Charts", url: "/charts", icon: BarChart3 },
  { title: "User Management", url: "/users", icon: UserCog },
  { title: "Profile", url: "/profile", icon: UserCircle2 },
];

const DashboardLayout = ({ title, subtitle, children }: DashboardLayoutProps) => {
  useCalendarNotifications();
  return (
    <SidebarProvider>
      <AiAssistant />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <main className="flex-1 flex flex-col min-w-0">
          <GlowHeader className="sticky top-0 z-40 sm:relative sm:z-30">
            <div className="flex items-center gap-2 sm:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    data-mobile-menu-trigger
                  >
                    ☰
                  </Button>
                </SheetTrigger>
                <SheetContent side="top" className="h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-4 grid gap-2">
                    {mobileMenuItems.map((item) => (
                      <NavLink
                        key={item.title}
                        to={item.url}
                        end
                        className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        activeClassName="bg-slate-900 text-white border-slate-900"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
            <div className="hidden sm:flex">
              <SidebarTrigger />
            </div>
            <DashboardHeader title={title} subtitle={subtitle} />
          </GlowHeader>

          <div className="flex-1 p-4 pb-24 space-y-6 sm:p-6 sm:pb-6 min-w-0 overflow-x-hidden">{children}</div>
        </main>
      </div>
      <MobileBottomNav
        onOpenMenu={() => {
          const trigger = document.querySelector<HTMLButtonElement>("[data-mobile-menu-trigger]");
          trigger?.click();
        }}
      />
    </SidebarProvider>
  );
};

export default DashboardLayout;

import { useMemo, useEffect, useRef, useCallback } from "react";
import {
  Archive,
  BarChart3,
  ClipboardList,
  DatabaseZap,
  Flag,
  Home,
  LogOut,
  MapPin,
  Users,
  UserCog,
  HeartPulse,
  Baby,
  CircleHelp,
  Calendar,
  Briefcase,
  BookOpen,
  Gauge,
  Sparkles,
  ChevronRight,
  Share2, ClipboardCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFileUrl } from "@/lib/directus";

const sections = [
  {
    label: "Overview",
    items: [
      { title: "Home", url: "/dashboard", icon: Home },
      { title: "Calendar", url: "/calendar", icon: Calendar },
      { title: "Districts", url: "/districts", icon: MapPin },
      { title: "Program Dashboard", url: "/charts", icon: BarChart3 },
    ],
  },
  {
    label: "Registers",
    items: [
      { title: "Households", url: "/households", icon: Home },
      { title: "VCAs", url: "/vcas", icon: Users },
      { title: "HTS Register", url: "/registers/hts", icon: Users },
      { title: "PMTCT", url: "/registers/pmtct", icon: HeartPulse },
      {
        title: "Mother Index Register",
        url: "/registers/mother-index",
        icon: Baby,
      },
    ],
  },
  {
    label: "Archived",
    items: [
      { title: "Households", url: "/households/archived", icon: Archive },
      { title: "VCAs", url: "/vcas/archived", icon: Archive },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Household Services", url: "/household-services", icon: Home },
      { title: "VCA Services", url: "/vca-services", icon: ClipboardList },
      {
        title: "Caregiver Services",
        url: "/caregiver-services",
        icon: HeartPulse,
      },
      { title: "Referrals", url: "/referrals", icon: Share2 },
      { title: "Performance", url: "/performance", icon: Gauge },
      {
        title: "Caseworker Journeys",
        url: "/caseworker-journeys",
        icon: MapPin,
      },
      { title: "Flags", url: "/flags", icon: Flag },
      { title: "Training Log", url: "/training-log", icon: ClipboardCheck},
    ],
  },
  {
    label: "Data pipeline",
    items: [
      { title: "Data Pipeline", url: "/data-pipeline", icon: DatabaseZap },
    ],
  },
  {
    label: "Admin",
    items: [{ title: "Users", url: "/users", icon: UserCog }],
  },
  {
    label: "Help & support",
    items: [
      { title: "Support Center", url: "/support", icon: CircleHelp },
      { title: "Documentation", url: "/documentation", icon: BookOpen },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const currentPath = location.pathname;

  // ── Preserve sidebar scroll position across navigations ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = "ecap_sidebar_scroll";

  const saveScroll = useCallback(() => {
    if (scrollRef.current) {
      sessionStorage.setItem(SCROLL_KEY, String(scrollRef.current.scrollTop));
    }
  }, []);

  // Restore scroll position when the location changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      // Use rAF so the sidebar has finished rendering before we set scrollTop
      requestAnimationFrame(() => {
        el.scrollTop = Number(saved);
      });
    }
  }, [location.pathname]);

  const filteredSections = useMemo(() => {
    if (!user) return [];

    const roleName = (
      typeof user.role === "string" ? user.role : user.role?.name || ""
    ).toLowerCase();
    const isAdmin =
      roleName === "administrator" ||
      user.description === "Administrator" ||
      (!user.description && roleName !== "");
    const isSupport =
      user.description === "Support User" || roleName.includes("support");
    const isDistrictUser = user.description === "District User";
    const isProvincialUser = user.description === "Provincial User";

    return sections
      .map((section) => {
        const filteredItems = section.items.filter((item) => {
          // Districts page: Restricted for District Users (per security intent)
          if (item.url === "/districts" && isDistrictUser) return false;

          // Admin: Only for Administrators
          if (section.label === "Admin" && !isAdmin) return false;

          // Data Pipeline: Only for Admins and Support
          if (section.label === "Data Pipeline" && !isAdmin && !isSupport)
            return false;

          return true;
        });

        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  }, [user]);

  const isActive = (path: string) => currentPath === path;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-emerald-100/60 bg-white/70 backdrop-blur-xl"
    >
      {/* Aurora background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(14,165,233,0.08),transparent_50%)]" />
        <div className="absolute -top-32 -left-16 h-[20rem] w-[20rem] rounded-full bg-emerald-300/20 blur-[100px] animate-pulse [animation-duration:8s]" />
        <div className="absolute -bottom-24 -right-12 h-[22rem] w-[22rem] rounded-full bg-teal-300/15 blur-[110px] animate-pulse [animation-duration:10s] [animation-delay:-3s]" />
      </div>

      {/* Logo */}
      <SidebarHeader className="px-5 py-5 border-b border-emerald-100/40">
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center",
          )}
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 shadow-md shadow-emerald-500/30">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.4} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                PMP
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-600/80">
                Program Operations
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-3" ref={scrollRef} onScroll={saveScroll}>
        {filteredSections.map((section) => (
          <SidebarGroup key={section.label} className="pb-2 pt-3">
            <SidebarGroupLabel className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/70">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                      >
                        <NavLink
                          to={item.url}
                          end
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-xs font-semibold transition-all duration-200",
                            active
                              ? "bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent text-emerald-700 shadow-sm ring-1 ring-emerald-200/60"
                              : "text-slate-600 hover:bg-gradient-to-r hover:from-emerald-50/70 hover:via-teal-50/40 hover:to-transparent hover:text-emerald-700",
                          )}
                          activeClassName=""
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)]"
                            />
                          )}
                          <item.icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-colors",
                              active
                                ? "text-emerald-600"
                                : "text-slate-400 group-hover:text-emerald-600",
                            )}
                            strokeWidth={active ? 2.2 : 1.8}
                          />
                          <span className="flex-1">{item.title}</span>
                          {active && !collapsed && (
                            <ChevronRight
                              className="h-3 w-3 text-emerald-500/70"
                              strokeWidth={2.4}
                            />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-emerald-100/40 px-4 py-3">
        {user && (
          <div
            className={cn(
              "group flex items-center gap-3 rounded-lg py-2 mb-1 cursor-pointer transition-all hover:bg-gradient-to-r hover:from-emerald-50/70 hover:via-teal-50/40 hover:to-transparent -mx-1 px-2",
              collapsed && "justify-center mx-0 px-0",
            )}
            onClick={() => navigate("/profile")}
          >
            <div className="relative shrink-0">
              <div
                aria-hidden
                className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-emerald-400/60 via-teal-400/40 to-sky-400/40 blur-sm opacity-70 transition-opacity group-hover:opacity-100"
              />
              <Avatar className="relative h-8 w-8 ring-2 ring-white shadow-sm rounded-full">
                <AvatarImage
                  src={user.avatar ? getFileUrl(user.avatar) : undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 text-white text-xs font-extrabold uppercase rounded-full">
                  {user.first_name?.[0] ?? user.email?.[0] ?? "U"}
                </AvatarFallback>
              </Avatar>
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-700 transition-colors">
                  {user.first_name
                    ? `${user.first_name} ${user.last_name ?? ""}`.trim()
                    : user.email}
                </span>
                {/*<span className="text-[10px] text-emerald-600/80 truncate leading-tight mt-0.5 font-semibold">*/}
                {/*  {typeof user.role === "string"*/}
                {/*    ? user.role*/}
                {/*    : (user.role?.name ?? "User")}*/}
                {/*</span>*/}
              </div>
            )}
          </div>
        )}
        <button
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-gradient-to-r hover:from-rose-50/80 hover:via-pink-50/40 hover:to-transparent hover:text-rose-600 -mx-1",
            collapsed && "justify-center mx-0 px-0",
          )}
          onClick={handleLogout}
        >
          <LogOut
            className="h-[18px] w-[18px] shrink-0 transition-colors group-hover:text-rose-500"
            strokeWidth={1.8}
          />
          {!collapsed && <span>Logout</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

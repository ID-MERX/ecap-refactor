import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { getChildrenByDistrict, getHouseholdsByDistrict, DEFAULT_DISTRICT } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Home,
  Search,
  MapPin,
  BarChart3,
  ClipboardList,
  HeartPulse,
  Flag,
  Archive,
  UserCog,
  UserCircle2,
  Book,
  HelpCircle,
  Briefcase,
} from "lucide-react";
import { quickHelpLinks, faqs } from "@/data/supportData";

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, category: "Navigation" },
  { title: "Districts", url: "/districts", icon: MapPin, category: "Navigation" },
  { title: "Household Register", url: "/households", icon: Home, category: "Navigation" },
  { title: "VCA Register", url: "/vcas", icon: Users, category: "Navigation" },
  { title: "VCA Services", url: "/vca-services", icon: ClipboardList, category: "Navigation" },
  { title: "Caregiver Services", url: "/caregiver-services", icon: HeartPulse, category: "Navigation" },
  { title: "Flags", url: "/flags", icon: Flag, category: "Navigation" },
  { title: "Household Archived", url: "/households/archived", icon: Archive, category: "Navigation" },
  { title: "VCA Archived", url: "/vcas/archived", icon: Archive, category: "Navigation" },
  { title: "Charts", url: "/charts", icon: BarChart3, category: "Navigation" },
  { title: "User Management", url: "/users", icon: UserCog, category: "Navigation" },
  { title: "My Profile", url: "/profile", icon: UserCircle2, category: "Navigation" },
];

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const district = user?.location ?? DEFAULT_DISTRICT;

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: vcas } = useQuery({
    queryKey: ["vcas", "search", district],
    queryFn: () => getChildrenByDistrict(district ?? ""),
    enabled: open && Boolean(district),
  });

  const { data: households } = useQuery({
    queryKey: ["households", "search", district],
    queryFn: () => getHouseholdsByDistrict(district ?? ""),
    enabled: open && Boolean(district),
  });

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const pickValue = (record: any, keys: string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && value !== "") return String(value);
    }
    return "";
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex w-full items-center justify-start rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-muted-foreground shadow-sm transition-all hover:bg-white hover:shadow-md md:w-64 lg:w-80"
      >
        <Search className="mr-2 h-4 w-4 text-slate-400" />
        <span className="hidden lg:inline-flex font-medium">Search households, VCAs...</span>
        <span className="inline-flex lg:hidden font-medium">Search...</span>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a name, ID or page..." />
        <CommandList className="max-h-[450px]">
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => runCommand(() => navigate(item.url))}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="font-semibold text-foreground/90">{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {vcas && vcas.length > 0 && (
            <CommandGroup heading="Recent VCAs (District)">
              {vcas.slice(0, 10).map((vca: any) => {
                const id = pickValue(vca, ["vca_id", "vcaid", "child_id", "unique_id", "uid"]);
                const name = `${vca.firstname || vca.name || ""} ${vca.lastname || ""}`.trim();
                return (
                  <CommandItem
                    key={`vca-${id}`}
                    onSelect={() => runCommand(() => navigate(`/profile/vca-details`, { state: { id } }))}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                      <Users className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{name}</span>
                      <span className="text-[10px] text-muted-foreground tracking-wider font-bold">VCA ID: {id}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandSeparator />

          {households && households.length > 0 && (
            <CommandGroup heading="Recent Households (District)">
              {households.slice(0, 10).map((hh: any) => {
                const id = pickValue(hh, ["household_id", "householdId", "hh_id", "unique_id", "id"]);
                const name = String(hh.caregiver_name || hh.name || "Unknown Caregiver");
                return (
                  <CommandItem
                    key={`hh-${id}`}
                    onSelect={() => runCommand(() => navigate(`/profile/household-details`, { state: { id } }))}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                      <Home className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{name}</span>
                      <span className="text-[10px] text-muted-foreground tracking-wider font-bold">HH ID: {id}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup heading="Help & Documentation">
            {quickHelpLinks.map((item) => (
              <CommandItem
                key={item.title}
                onSelect={() => runCommand(() => navigate("/support"))}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <Book className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">Quick Guide • {item.time}</span>
                </div>
              </CommandItem>
            ))}
            {faqs.map((faq) => (
              <CommandItem
                key={faq.question}
                onSelect={() => runCommand(() => navigate("/support"))}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">{faq.question}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">FAQ</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

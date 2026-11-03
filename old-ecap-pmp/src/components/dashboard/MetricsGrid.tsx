import {
  ArrowRight,
  FileCheck,
  Home,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import AnimatedCounter from "@/components/AnimatedCounter";
import {
  getTotalHouseholdsCount,
  getTotalVcasCount,
  getHouseholdsByDistrict,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger";
  colorClass?: {
    iconBg: string;
    iconText: string;
    borderAccent: string;
  };
  // When set, the whole card becomes a button that navigates to this route.
  // Matches the dqa-dashboard MetricsGrid pattern.
  to?: string;
}

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  colorClass,
  isLoading,
  to,
}: MetricCardProps & { isLoading?: boolean }) => {
  const navigate = useNavigate();
  const variantStyles = {
    default: "text-primary",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-destructive",
  };

  const inner = (
    <GlowCard hoverable className={colorClass?.borderAccent}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          {colorClass ? (
            <div className={`rounded-lg p-2 ${colorClass.iconBg} ${colorClass.iconText}`}>
              {icon}
            </div>
          ) : (
            <div className={variantStyles[variant]}>{icon}</div>
          )}
          <CardTitle className="text-xs font-bold tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        {to && (
          <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-slate-700" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black text-foreground tracking-tight">
          {isLoading ? <LoadingDots className="text-muted-foreground" /> : <AnimatedCounter value={value} />}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs ${trend.isPositive ? "text-emerald-500" : "text-destructive"
                }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </GlowCard>
  );

  if (!to) return inner;

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group block w-full text-left cursor-pointer"
      aria-label={`${title} — ${subtitle}. Open ${title} register.`}
    >
      {inner}
    </button>
  );
};

const MetricsGrid = () => {
  const { user } = useAuth();
  const district = user?.location ?? "";
  const isProvincialUser = user?.description === "Provincial User";
  const userProvince = user?.title;

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  const totalVcasQuery = useQuery({
    queryKey: ["metrics", "total-vcas", district, fyKey],
    queryFn: () => getTotalVcasCount(district, fyArg),
    enabled: !!district,
  });

  const totalHouseholdsQuery = useQuery({
    queryKey: ["metrics", "total-households", district, fyKey],
    queryFn: () => getTotalHouseholdsCount(district, fyArg),
    enabled: !!district,
  });


  const householdsDataQuery = useQuery({
    queryKey: ["metrics", "households-list", district],
    queryFn: () => getHouseholdsByDistrict(district),
    enabled: !!district,
  });

  // For Provincial Users, filter households to their province
  const filteredHouseholdsData = useMemo(() => {
    if (!householdsDataQuery.data) return null;
    if (isProvincialUser && userProvince && userProvince !== "All") {
      return householdsDataQuery.data.filter((h: any) => h.province === userProvince);
    }
    return householdsDataQuery.data;
  }, [householdsDataQuery.data, isProvincialUser, userProvince]);

  // Distinct household count from the list data
  const distinctHouseholdsCount = useMemo(() => {
    if (!filteredHouseholdsData) return null;
    const uniqueIds = new Set(
      filteredHouseholdsData
        .map((h: any) => h.household_id || h.householdId || h.hh_id || h.id)
        .filter(Boolean)
    );
    return uniqueIds.size;
  }, [filteredHouseholdsData]);

  const caseworkersCount = useMemo(() => {
    if (!filteredHouseholdsData) return null;
    const uniqueCaseworkers = new Set(
      filteredHouseholdsData
        .map((h: any) => h.caseworker_name || h.cwac_member_name)
        .filter(Boolean)
    );
    return uniqueCaseworkers.size;
  }, [filteredHouseholdsData]);

  const formatCount = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    return new Intl.NumberFormat("en-GB").format(value);
  };

  const getListCount = (data: any[] | undefined) => {
    if (!data) return "N/A";
    return Array.isArray(data) ? formatCount(data.length) : "0";
  }

  const summaryMetrics = [
    {
      title: "VCAs",
      value: formatCount(totalVcasQuery.data),
      subtitle: "All registered children",
      icon: <Users className="h-5 w-5" />,
      variant: "default" as const,
      isLoading: totalVcasQuery.isLoading,
      to: "/vcas",
      colorClass: {
        iconBg: "bg-emerald-50",
        iconText: "text-emerald-600",
        borderAccent: "",
      },
    },
    {
      title: "Households",
      // Use the server-side COUNT(DISTINCT household_id) endpoint rather
      // than a client-side Set dedupe over the full list — the endpoint
      // is what the ecapplus-superset 'Total Households' chart uses, so
      // the two surfaces now agree exactly.
      value: formatCount(totalHouseholdsQuery.data),
      subtitle: "Distinct households tracked",
      icon: <Home className="h-5 w-5" />,
      variant: "success" as const,
      isLoading: totalHouseholdsQuery.isLoading,
      to: "/households",
      colorClass: {
        iconBg: "bg-emerald-50",
        iconText: "text-emerald-600",
        borderAccent: "",
      },
    },
    {
      title: "Caseworkers",
      value: formatCount(caseworkersCount),
      subtitle: district === "All" || !district ? "All active Caseworkers" : `Active in ${district}`,
      icon: <Users className="h-5 w-5" />,
      variant: "default" as const,
      isLoading: householdsDataQuery.isLoading,
      to: "/caseworker-journeys",
      colorClass: {
        iconBg: "bg-emerald-50",
        iconText: "text-emerald-600",
        borderAccent: "",
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>
    </div>
  );
};

export default MetricsGrid;

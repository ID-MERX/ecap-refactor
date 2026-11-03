import { useQuery } from "@tanstack/react-query";
import { PieChart as PieIcon, AlertTriangle } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getServiceDistribution } from "@/lib/api";
import GlowCard from "@/components/aceternity/GlowCard";
import { useFyFilter } from "@/context/FyFilterContext";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
}

const PILLAR_COLORS: Record<string, string> = {
  HIV:       "#e11d48",
  Health:    "#0ea5e9",
  Education: "#a855f7",
  Safety:    "#f59e0b",
  Stability: "#10b981",
  Household: "#6366f1",
};

const ServicesDistributionChart = ({ type, district, facility }: Props) => {
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["service-distribution", type, district, facility, fyKey],
    queryFn: () => getServiceDistribution({ type, district, facility, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });

  const slices = (data?.data ?? []).filter((s) => s.count > 0);

  return (
    <GlowCard className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PieIcon className="h-4 w-4 text-primary" />
            Service mix by domain (last 90 days)
          </CardTitle>
          {!isLoading && !isError && data && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {data.total.toLocaleString()} services
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-md bg-slate-100" />
        ) : isError ? (
          <div className="flex h-56 flex-col items-center justify-center text-center text-xs text-rose-600">
            <AlertTriangle className="mb-2 h-5 w-5" />
            <div>Failed to load distribution</div>
            <div className="mt-1 text-[10px] text-slate-400">{(error as Error)?.message}</div>
          </div>
        ) : slices.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-xs text-slate-400">
            No service activity in this window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <PieChart>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
                formatter={(v: number, _n, p: { payload?: { pct?: number } }) => [`${v.toLocaleString()} (${p?.payload?.pct ?? 0}%)`, "Services"]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
              <Pie
                data={slices}
                dataKey="count"
                nameKey="pillar"
                cx="50%"
                cy="45%"
                innerRadius={42}
                outerRadius={72}
                paddingAngle={2}
              >
                {slices.map((s) => (
                  <Cell key={s.pillar} fill={PILLAR_COLORS[s.pillar] ?? "#94a3b8"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </GlowCard>
  );
};

export default ServicesDistributionChart;

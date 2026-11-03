import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getServiceTimeseries } from "@/lib/api";
import GlowCard from "@/components/aceternity/GlowCard";
import { useFyFilter } from "@/context/FyFilterContext";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
}

const ServicesTimeSeriesChart = ({ type, district, facility }: Props) => {
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["service-timeseries", type, district, facility, fyKey],
    queryFn: () => getServiceTimeseries({ type, district, facility, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });

  const points = data?.data ?? [];
  const total = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <GlowCard className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-primary" />
            Services delivered per month (last 12 months)
          </CardTitle>
          {!isLoading && !isError && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {total.toLocaleString()} total
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
            <div>Failed to load timeseries</div>
            <div className="mt-1 text-[10px] text-slate-400">{(error as Error)?.message}</div>
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-xs text-slate-400">
            No services in this window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="svcVolEcapPlus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
                formatter={(v: number) => [v.toLocaleString(), "Services"]}
              />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#svcVolEcapPlus)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </GlowCard>
  );
};

export default ServicesTimeSeriesChart;

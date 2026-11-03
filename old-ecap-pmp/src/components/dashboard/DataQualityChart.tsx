import { useMemo, useState } from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  getCaregiverReferralsByMonth,
  getCaregiverServicesByMonth,
  getVcaReferralsByMonth,
  getVcaServicesByMonth,
} from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const chartConfig = {
  vcaServices: {
    label: "VCA Services",
    color: "hsl(var(--chart-1))",
  },
  caregiverServices: {
    label: "Caregiver Services",
    color: "hsl(var(--chart-2))",
  },
  vcaReferrals: {
    label: "VCA Referrals",
    color: "hsl(var(--chart-3))",
  },
  caregiverReferrals: {
    label: "Caregiver Referrals",
    color: "hsl(var(--chart-4))",
  },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DataQualityChart = () => {
  const { user } = useAuth();
  const district = user?.location ?? "";
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedDataType, setSelectedDataType] = useState<string>("all");

  const queries = {
    vcaServices: useQuery({
      queryKey: ["chart", "vca-services", district],
      queryFn: () => getVcaServicesByMonth(district),
      enabled: !!district,
    }),
    caregiverServices: useQuery({
      queryKey: ["chart", "caregiver-services", district],
      queryFn: () => getCaregiverServicesByMonth(district),
      enabled: !!district,
    }),
    vcaReferrals: useQuery({
      queryKey: ["chart", "vca-referrals", district],
      queryFn: () => getVcaReferralsByMonth(district),
      enabled: !!district,
    }),
    caregiverReferrals: useQuery({
      queryKey: ["chart", "caregiver-referrals", district],
      queryFn: () => getCaregiverReferralsByMonth(district),
      enabled: !!district,
    }),
  };

  const isLoading = Object.values(queries).some((q) => q.isLoading);

  const processedData = useMemo(() => {
    if (isLoading) return [];

    const dataByMonth = new Map<string, any>();

    // Initialize months
    MONTHS.forEach(month => {
      dataByMonth.set(month, {
        month,
        vcaServices: 0,
        caregiverServices: 0,
        vcaReferrals: 0,
        caregiverReferrals: 0,
      });
    });

    const processItems = (items: any[], key: string, dateKey: string) => {
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        if (!item[dateKey]) return;

        // Handle various date formats: YYYY-MM, MM-YYYY, YYYY-MM-DD
        const parts = String(item[dateKey]).split("-");
        let monthStr = "";
        let yearStr = "";

        if (parts[0].length === 4) {
          // YYYY-MM or YYYY-MM-DD
          yearStr = parts[0];
          monthStr = parts[1];
        } else if (parts.length >= 2) {
          // MM-YYYY
          monthStr = parts[0];
          yearStr = parts[parts.length - 1];
        }

        if (yearStr === selectedYear) {
          const monthIndex = parseInt(monthStr, 10) - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            const monthName = MONTHS[monthIndex];

            // If a specific month is selected, we only process data for that month
            // but we keep ALL months in the map so the chart trend stays consistent
            if (selectedMonth !== "all" && monthName !== selectedMonth) return;

            const entry = dataByMonth.get(monthName);
            if (entry) {
              const count = Number(item.count || item.service_count || item.referral_count || 0);

              // Filter by data type if selected
              if (selectedDataType === "all" || key === selectedDataType) {
                entry[key] += count;
              }
            }
          }
        }
      });
    };

    processItems(queries.vcaServices.data ?? [], "vcaServices", "service_month");
    processItems(queries.caregiverServices.data ?? [], "caregiverServices", "service_month");
    processItems(queries.vcaReferrals.data ?? [], "vcaReferrals", "referral_month");
    processItems(queries.caregiverReferrals.data ?? [], "caregiverReferrals", "referral_month");

    return Array.from(dataByMonth.values());
  }, [queries, selectedYear, selectedMonth, selectedDataType, isLoading]);

  const handleExportCSV = () => {
    if (!processedData || processedData.length === 0) return;

    const headers = ["Month", "VCA Services", "Caregiver Services", "VCA Referrals", "Caregiver Referrals"];
    const csvContent = [
      headers.join(","),
      ...processedData.map((row) =>
        [
          row.month,
          row.vcaServices,
          row.caregiverServices,
          row.vcaReferrals,
          row.caregiverReferrals
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `services_referrals_${selectedYear}_${selectedMonth}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <GlowCard>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-black text-xl tracking-tight">Services & Referrals Trend</CardTitle>
              <CardDescription>Monthly breakdown of services and referrals for {selectedYear}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handleExportCSV} title="Export to CSV">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {["2023", "2024", "2025", "2026"].map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDataType} onValueChange={setSelectedDataType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Data</SelectItem>
                <SelectItem value="vcaServices">VCA Services</SelectItem>
                <SelectItem value="caregiverServices">Caregiver Services</SelectItem>
                <SelectItem value="vcaReferrals">VCA Referrals</SelectItem>
                <SelectItem value="caregiverReferrals">Caregiver Referrals</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <LoadingDots />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillVcaServices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-vcaServices)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-vcaServices)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillCaregiverServices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-caregiverServices)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-caregiverServices)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillVcaReferrals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-vcaReferrals)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-vcaReferrals)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillCaregiverReferrals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-caregiverReferrals)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-caregiverReferrals)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.slice(0, 3)}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />

                {(selectedDataType === "all" || selectedDataType === "vcaServices") && (
                  <Area
                    type="monotone"
                    dataKey="vcaServices"
                    fill="url(#fillVcaServices)"
                    stroke="var(--color-vcaServices)"
                    stackId="1"
                  />
                )}
                {(selectedDataType === "all" || selectedDataType === "caregiverServices") && (
                  <Area
                    type="monotone"
                    dataKey="caregiverServices"
                    fill="url(#fillCaregiverServices)"
                    stroke="var(--color-caregiverServices)"
                    stackId="1"
                  />
                )}
                {(selectedDataType === "all" || selectedDataType === "vcaReferrals") && (
                  <Area
                    type="monotone"
                    dataKey="vcaReferrals"
                    fill="url(#fillVcaReferrals)"
                    stroke="var(--color-vcaReferrals)"
                    stackId="1"
                  />
                )}
                {(selectedDataType === "all" || selectedDataType === "caregiverReferrals") && (
                  <Area
                    type="monotone"
                    dataKey="caregiverReferrals"
                    fill="url(#fillCaregiverReferrals)"
                    stroke="var(--color-caregiverReferrals)"
                    stackId="1"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </GlowCard>
  );
};

export default DataQualityChart;

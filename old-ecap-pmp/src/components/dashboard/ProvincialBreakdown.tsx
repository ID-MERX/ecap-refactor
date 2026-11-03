import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getHouseholdsByDistrict } from "@/lib/api";
import { useMemo } from "react";

const ProvincialBreakdown = () => {
  const { user } = useAuth();
  const district = user?.location ?? "";

  const { data: households, isLoading } = useQuery({
    queryKey: ["households-list", district],
    queryFn: () => getHouseholdsByDistrict(district),
    enabled: !!district,
  });

  const villageStats = useMemo(() => {
    if (!households) return [];

    const counts: Record<string, number> = {};
    households.forEach((h: any) => {
      // Use village or zone, fallback to "Unknown"
      const location = h.village || h.zone || "Unspecified";
      counts[location] = (counts[location] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  }, [households]);

  const maxCount = villageStats[0]?.count || 1;

  return (
    <GlowCard>
      <CardHeader>
        <CardTitle>Geographic Breakdown</CardTitle>
        <CardDescription>Top Villages/Zones in {district || "district"}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <LoadingDots />
          </div>
        ) : villageStats.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
            No geographic data available.
          </div>
        ) : (
          <div className="space-y-6">
            {villageStats.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground">{item.count} households</div>
                </div>
                <Progress value={(item.count / maxCount) * 100} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </GlowCard>
  );
};

export default ProvincialBreakdown;

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  ListChecks,
  Search,
} from "lucide-react";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv";
import {
  getActionQueue,
  getDuplicates,
  type ActionItem,
  type DuplicateGroup,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ISSUE_META, SERVICE_TYPE_META, type ServiceType } from "./service-records";

interface Props {
  type: ServiceType;
  district?: string;
  issueCounts: Record<string, number>;
  activeIssue: string | null;
  onIssueChange: (key: string | null) => void;
  onDuplicateFocus: (entityId: string) => void;
}

const SEVERITY_CLASS: Record<ActionItem["severity"], string> = {
  red: "border-rose-200 bg-rose-50 text-rose-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

const ISSUE_CLASS: Record<string, string> = {
  missing_date: "border-rose-200 bg-rose-50 text-rose-700",
  no_service_details: "border-rose-200 bg-rose-50 text-rose-700",
  missing_caseworker: "border-amber-200 bg-amber-50 text-amber-700",
  missing_district: "border-amber-200 bg-amber-50 text-amber-700",
  stale_90d: "border-slate-200 bg-slate-50 text-slate-700",
};

const inferIssueKey = (item: ActionItem) => {
  const text = `${item.key} ${item.label} ${item.filter?.type ?? ""}`.toLowerCase();
  if (text.includes("date")) return "missing_date";
  if (text.includes("caseworker") || text.includes("worker")) return "missing_caseworker";
  if (text.includes("district")) return "missing_district";
  if (text.includes("stale") || text.includes("90")) return "stale_90d";
  if (text.includes("service")) return "no_service_details";
  return null;
};

const formatDate = (value: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const duplicateRedundantCount = (groups: DuplicateGroup[]) => {
  return groups.reduce((sum, group) => sum + Math.max(0, Number(group.duplicate_count) - 1), 0);
};

const QualityReviewPanel = ({
  type,
  district,
  issueCounts,
  activeIssue,
  onIssueChange,
  onDuplicateFocus,
}: Props) => {
  const [activeTab, setActiveTab] = useState("actions");

  const actionQuery = useQuery({
    queryKey: ["quality-review", "action-queue", type, district],
    queryFn: () => getActionQueue({ type, district }),
    staleTime: 5 * 60 * 1000,
  });

  const duplicateQuery = useQuery({
    queryKey: ["quality-review", "duplicates", type, district],
    queryFn: () => getDuplicates({ type, district }),
    staleTime: 5 * 60 * 1000,
  });

  const actionItems = actionQuery.data?.data ?? [];
  const duplicateGroups = duplicateQuery.data?.groups ?? [];
  const dataGapTotal = useMemo(
    () => Object.values(issueCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    [issueCounts],
  );
  const actionTotal = actionItems.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const duplicateTotal = duplicateQuery.data?.summary?.total_redundant_records ?? duplicateRedundantCount(duplicateGroups);
  const isLoading = actionQuery.isLoading || duplicateQuery.isLoading;

  const handleExportDuplicates = () => {
    if (duplicateGroups.length === 0) {
      toast.error("No duplicate records available to export.");
      return;
    }

    const headers = [
      "Service Type",
      "Entity ID",
      "Service Date",
      "Services",
      "Duplicate Count",
      "Redundant Records",
      "Caseworker",
      "Facility",
      "District",
      "Province",
    ];

    const rows = duplicateGroups.map((group) => [
      SERVICE_TYPE_META[type].shortLabel,
      group.entity_id,
      group.service_date,
      group.services,
      group.duplicate_count,
      Math.max(0, Number(group.duplicate_count) - 1),
      group.caseworker_name,
      group.facility,
      group.district,
      group.province,
    ]);

    const scope = district ? district.toLowerCase().replace(/\s+/g, "-") : "all-districts";
    downloadCsv(`${type}-duplicate-groups-${scope}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("Duplicate records exported.");
  };

  return (
    <GlowCard>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="h-4 w-4 text-primary" />
            Quality Review
            {isLoading && <LoadingDots className="text-slate-400" />}
          </CardTitle>
          <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleExportDuplicates}>
            <Download className="h-3.5 w-3.5" />
            Export duplicates
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <SummaryButton
            icon={AlertTriangle}
            label="Needs action"
            value={actionTotal}
            tone="border-amber-200 bg-amber-50 text-amber-700"
            onClick={() => setActiveTab("actions")}
          />
          <SummaryButton
            icon={Copy}
            label="Duplicate records"
            value={duplicateTotal}
            tone="border-rose-200 bg-rose-50 text-rose-700"
            onClick={() => setActiveTab("duplicates")}
          />
          <SummaryButton
            icon={Filter}
            label="Data gaps"
            value={dataGapTotal}
            tone="border-slate-200 bg-slate-50 text-slate-700"
            onClick={() => setActiveTab("gaps")}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9 bg-slate-100">
            <TabsTrigger value="actions" className="h-7 text-xs">Action Queue</TabsTrigger>
            <TabsTrigger value="duplicates" className="h-7 text-xs">Duplicates</TabsTrigger>
            <TabsTrigger value="gaps" className="h-7 text-xs">Data Gaps</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="mt-3">
            {actionQuery.isLoading ? (
              <PanelLoading />
            ) : actionItems.length === 0 || actionTotal === 0 ? (
              <PanelEmpty label="No action queue items for the current scope." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead className="w-[120px]">Severity</TableHead>
                      <TableHead className="w-[100px] text-right">Count</TableHead>
                      <TableHead className="w-[90px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.map((item) => {
                      const issueKey = inferIssueKey(item);
                      return (
                        <TableRow key={item.key}>
                          <TableCell>
                            <div className="font-medium text-slate-800">{item.label}</div>
                            <div className="max-w-2xl truncate text-xs text-slate-500">{item.description}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px]", SEVERITY_CLASS[item.severity])}>
                              {item.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{item.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={!issueKey}
                              onClick={() => issueKey && onIssueChange(issueKey)}
                            >
                              Filter
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="duplicates" className="mt-3">
            {duplicateQuery.isLoading ? (
              <PanelLoading />
            ) : duplicateGroups.length === 0 ? (
              <PanelEmpty label="No duplicate records found for the current scope." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Caseworker</TableHead>
                      <TableHead className="w-[110px] text-right">Duplicates</TableHead>
                      <TableHead className="w-[90px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicateGroups.slice(0, 8).map((group) => (
                      <TableRow key={`${group.entity_id}-${group.service_date}-${group.services}`}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-800">{group.entity_id}</TableCell>
                        <TableCell className="text-sm text-slate-700">{formatDate(group.service_date)}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-sm text-slate-700">{group.services || "N/A"}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm text-slate-700">{group.caseworker_name || "N/A"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-rose-700">
                          {Number(group.duplicate_count).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => onDuplicateFocus(group.entity_id)}
                          >
                            <Search className="h-3.5 w-3.5" />
                            Focus
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="gaps" className="mt-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {Object.entries(ISSUE_META).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onIssueChange(activeIssue === key ? null : key)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    ISSUE_CLASS[key],
                    activeIssue === key ? "ring-2 ring-primary/30" : "hover:bg-white",
                  )}
                >
                  <div className="font-mono text-xl font-bold">{(issueCounts[key] ?? 0).toLocaleString()}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{item.label}</div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </GlowCard>
  );
};

const SummaryButton = ({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: string;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-white", tone)}>
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      <Icon className="h-4 w-4" />
    </div>
    <div className="mt-2 font-mono text-2xl font-bold">{value.toLocaleString()}</div>
  </button>
);

const PanelLoading = () => (
  <div className="flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
    <LoadingDots className="text-slate-400" />
  </div>
);

const PanelEmpty = ({ label }: { label: string }) => (
  <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    {label}
  </div>
);

export default QualityReviewPanel;

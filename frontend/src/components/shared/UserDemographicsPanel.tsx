import { useMemo, useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { UserDemographicsResponse, DistributionItem, DemographicsFilter, UserRecord } from "@/types";
import { EMPTY_FILTER } from "@/types";

interface UserDemographicsPanelProps {
  data: UserDemographicsResponse | null;
  loading?: boolean;
  error?: string | null;
  filter: DemographicsFilter;
  onFilterChange: (filter: DemographicsFilter) => void;
}

type Dimension = keyof DemographicsFilter;

const NAME_TO_RAW: Record<string, string> = {};

function translateDistribution(items: DistributionItem[], t: (key: string) => string) {
  const nameMap: Record<string, string> = {
    "男": t("demographics.gender.male"),
    "女": t("demographics.gender.female"),
    "保密": t("demographics.gender.secret"),
    "未知": t("demographics.unknown"),
    "非大会员": t("demographics.vip.nonVip"),
    "月度大会员": t("demographics.vip.monthly"),
    "年度大会员": t("demographics.vip.annual"),
    LV0: "LV0", LV1: "LV1", LV2: "LV2", LV3: "LV3",
    LV4: "LV4", LV5: "LV5", LV6: "LV6",
  };

  return items.map((item) => {
    const translated = nameMap[item.name] ?? item.name;
    if (translated !== item.name) {
      NAME_TO_RAW[translated] = item.name;
    }
    return { ...item, name: translated };
  });
}

function toRawValue(displayName: string): string {
  return NAME_TO_RAW[displayName] ?? displayName;
}

function filterIsEmpty(f: DemographicsFilter): boolean {
  return f.gender.length === 0 && f.vip.length === 0 && f.level.length === 0 && f.location.length === 0;
}

function filtersEqual(a: DemographicsFilter, b: DemographicsFilter): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyFilters(users: UserRecord[], filter: DemographicsFilter, excludeDimension?: Dimension): UserRecord[] {
  return users.filter((u) => {
    for (const dim of ["gender", "vip", "level", "location"] as Dimension[]) {
      if (dim === excludeDimension) continue;
      const selected = filter[dim];
      if (selected.length === 0) continue;
      const val = dim === "location" ? (u.location ?? "") : u[dim];
      if (!selected.includes(val)) return false;
    }
    return true;
  });
}

function computeDistribution(users: UserRecord[], dimension: Dimension, order: string[]): DistributionItem[] {
  const counter = new Map<string, number>();
  for (const u of users) {
    const val = dimension === "location" ? (u.location ?? "") : u[dimension];
    if (dimension === "location" && !val) continue;
    counter.set(val, (counter.get(val) || 0) + 1);
  }
  const result: DistributionItem[] = [];
  const seen = new Set<string>();
  for (const name of order) {
    seen.add(name);
    const v = counter.get(name);
    if (v && v > 0) result.push({ name, value: v });
  }
  for (const [name, value] of counter) {
    if (!seen.has(name) && value > 0) result.push({ name, value });
  }
  return result;
}

const GENDER_ORDER = ["男", "女", "保密", "未知"];
const VIP_ORDER = ["非大会员", "月度大会员", "年度大会员", "未知"];
const LEVEL_ORDER = ["LV0", "LV1", "LV2", "LV3", "LV4", "LV5", "LV6", "未知"];

function buildPieOption(
  title: string, items: DistributionItem[], isDark: boolean,
  selected: string[],
) {
  const hasSelection = selected.length > 0;
  const data = items.map((item) => ({
    ...item,
    itemStyle: hasSelection
      ? { opacity: selected.includes(toRawValue(item.name)) ? 1 : 0.3 }
      : undefined,
  }));
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      textStyle: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
    },
    title: {
      text: title, left: "center", top: 0,
      textStyle: { color: isDark ? "#f3f4f6" : "#111827", fontSize: 13, fontWeight: 500 },
    },
    series: [{
      type: "pie", radius: ["45%", "70%"], center: ["50%", "45%"],
      label: { formatter: "{d}%", color: isDark ? "#d1d5db" : "#374151", fontSize: 11 },
      cursor: "pointer",
      data,
    }],
  };
}

function buildBarOption(
  title: string, items: DistributionItem[], isDark: boolean,
  selected: string[],
) {
  const hasSelection = selected.length > 0;
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    title: {
      text: title, left: "center", top: 0,
      textStyle: { color: isDark ? "#f3f4f6" : "#111827", fontSize: 13, fontWeight: 500 },
    },
    grid: { left: 40, right: 16, top: 36, bottom: 30 },
    xAxis: {
      type: "category",
      data: items.map((item) => item.name),
      axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#374151" : "#e5e7eb" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" } },
    },
    series: [{
      type: "bar", cursor: "pointer", barMaxWidth: 42,
      data: items.map((item) => ({
        value: item.value,
        itemStyle: {
          color: "#6366f1",
          opacity: hasSelection ? (selected.includes(toRawValue(item.name)) ? 1 : 0.3) : 1,
        },
      })),
    }],
  };
}

function buildHorizontalBarOption(
  title: string, items: DistributionItem[], isDark: boolean,
  selected: string[],
) {
  const hasSelection = selected.length > 0;
  // Reorder: selected first, then unselected — after reverse, selected end up at the visual top
  const reordered = hasSelection
    ? [
        ...items.filter((it) => selected.includes(toRawValue(it.name))),
        ...items.filter((it) => !selected.includes(toRawValue(it.name))),
      ]
    : items;
  const names = reordered.map((item) => item.name).reverse();
  const data = reordered.map((item) => ({
    value: item.value,
    itemStyle: {
      color: "#6366f1",
      opacity: hasSelection ? (selected.includes(toRawValue(item.name)) ? 1 : 0.3) : 1,
    },
  })).reverse();
  const total = names.length;
  const visibleCount = 10;
  const needsZoom = total > visibleCount;
  const startIdx = needsZoom ? total - visibleCount : 0;
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    title: {
      text: title, left: "center", top: 0,
      textStyle: { color: isDark ? "#f3f4f6" : "#111827", fontSize: 13, fontWeight: 500 },
    },
    grid: { left: 60, right: 16, top: 36, bottom: 8 },
    xAxis: {
      type: "value",
      axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" } },
    },
    yAxis: {
      type: "category", data: names,
      axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#374151" : "#e5e7eb" } },
    },
    dataZoom: needsZoom
      ? [{
          type: "slider",
          yAxisIndex: 0,
          right: 0,
          width: 12,
          startValue: startIdx,
          endValue: total - 1,
          minValueSpan: visibleCount - 1,
          brushSelect: false,
          handleSize: "60%",
          borderColor: "transparent",
          fillerColor: isDark ? "rgba(100,102,241,0.25)" : "rgba(100,102,241,0.15)",
          handleStyle: { color: isDark ? "#6366f1" : "#818cf8" },
        }]
      : [],
    series: [{
      type: "bar", cursor: "pointer", barMaxWidth: 20, data,
    }],
  };
}

export default function UserDemographicsPanel({
  data, loading = false, error = null, filter, onFilterChange,
}: UserDemographicsPanelProps) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");
  const users = data?.users ?? [];

  // Pending filter: staged selections not yet applied
  const [pending, setPending] = useState<DemographicsFilter>({ ...filter });

  // Sync pending when confirmed filter changes externally (e.g., clear from parent)
  useEffect(() => {
    setPending({ ...filter });
  }, [filter]);

  const hasPendingSelection = !filterIsEmpty(pending);
  const hasConfirmedFilter = !filterIsEmpty(filter);
  const pendingDiffers = !filtersEqual(pending, filter);

  const togglePending = useCallback((dimension: Dimension, rawValue: string) => {
    setPending((prev) => {
      const current = prev[dimension];
      const next = current.includes(rawValue)
        ? current.filter((v) => v !== rawValue)
        : [...current, rawValue];
      return { ...prev, [dimension]: next };
    });
  }, []);

  const makeClickHandler = useCallback((dimension: Dimension) => {
    return (params: { name?: string; data?: { name?: string } }) => {
      const displayName = params.name || params.data?.name;
      if (!displayName) return;
      togglePending(dimension, toRawValue(displayName));
    };
  }, [togglePending]);

  const handleApply = useCallback(() => {
    onFilterChange({ ...pending });
  }, [pending, onFilterChange]);

  const handleClear = useCallback(() => {
    const empty = { ...EMPTY_FILTER };
    setPending(empty);
    onFilterChange(empty);
  }, [onFilterChange]);

  // Chart data: cross-filtered by CONFIRMED filter; original when no confirmed filter
  // Each chart excludes its own dimension from the confirmed filter (so its own options stay visible)
  const vipItems = useMemo(() => {
    if (!hasConfirmedFilter || !users.length) return translateDistribution(data?.vip_ratio ?? [], t);
    const filtered = applyFilters(users, filter, "vip");
    return translateDistribution(computeDistribution(filtered, "vip", VIP_ORDER), t);
  }, [users, filter, hasConfirmedFilter, data?.vip_ratio, t]);

  const genderItems = useMemo(() => {
    if (!hasConfirmedFilter || !users.length) return translateDistribution(data?.gender_ratio ?? [], t);
    const filtered = applyFilters(users, filter, "gender");
    return translateDistribution(computeDistribution(filtered, "gender", GENDER_ORDER), t);
  }, [users, filter, hasConfirmedFilter, data?.gender_ratio, t]);

  const levelItems = useMemo(() => {
    if (!hasConfirmedFilter || !users.length) return translateDistribution(data?.level_distribution ?? [], t);
    const filtered = applyFilters(users, filter, "level");
    return translateDistribution(computeDistribution(filtered, "level", LEVEL_ORDER), t);
  }, [users, filter, hasConfirmedFilter, data?.level_distribution, t]);

  const locationItems = useMemo(() => {
    if (!hasConfirmedFilter || !users.length) return data?.location_distribution ?? [];
    const filtered = applyFilters(users, filter, "location");
    return computeDistribution(filtered, "location", []).sort((a, b) => b.value - a.value);
  }, [users, filter, hasConfirmedFilter, data?.location_distribution]);

  // Filtered count uses confirmed filter
  const filteredCount = useMemo(() => {
    if (!hasConfirmedFilter || !users.length) return data?.total_unique_users ?? 0;
    return applyFilters(users, filter).length;
  }, [users, filter, hasConfirmedFilter, data?.total_unique_users]);

  // Preview count uses pending filter (shown when pending differs)
  const previewCount = useMemo(() => {
    if (!hasPendingSelection || !users.length) return data?.total_unique_users ?? 0;
    return applyFilters(users, pending).length;
  }, [users, pending, hasPendingSelection, data?.total_unique_users]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!data || data.total_unique_users === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t("demographics.title")}</p>
          <p className="text-xs text-muted-foreground">
            {hasConfirmedFilter
              ? t("demographics.filtered", { count: filteredCount })
              : hasPendingSelection && pendingDiffers
                ? t("demographics.filtered", { count: previewCount })
                : t("demographics.uniqueUsers", { count: data.total_unique_users })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingDiffers && hasPendingSelection && (
            <button
              onClick={handleApply}
              className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("demographics.applyFilter")}
            </button>
          )}
          {(hasPendingSelection || hasConfirmedFilter) && (
            <button
              onClick={handleClear}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              {t("demographics.clearFilter")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 p-2">
          <ReactECharts
            option={buildPieOption(t("demographics.vipRatio"), vipItems, isDark, pending.vip)}
            style={{ height: 260 }}
            onEvents={{ click: makeClickHandler("vip") }}
          />
        </div>
        <div className="rounded-lg border border-border/60 p-2">
          <ReactECharts
            option={buildPieOption(t("demographics.genderRatio"), genderItems, isDark, pending.gender)}
            style={{ height: 260 }}
            onEvents={{ click: makeClickHandler("gender") }}
          />
        </div>
        <div className="rounded-lg border border-border/60 p-2">
          <ReactECharts
            option={buildBarOption(t("demographics.levelDistribution"), levelItems, isDark, pending.level)}
            style={{ height: 260 }}
            onEvents={{ click: makeClickHandler("level") }}
          />
        </div>
        {locationItems.length > 0 && (
          <div className="rounded-lg border border-border/60 p-2">
            <ReactECharts
              option={buildHorizontalBarOption(t("demographics.locationDistribution"), locationItems, isDark, pending.location)}
              style={{ height: 260 }}
              onEvents={{ click: makeClickHandler("location") }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { UserDemographicsResponse, DistributionItem } from "@/types";

interface UserDemographicsPanelProps {
  data: UserDemographicsResponse | null;
  loading?: boolean;
  error?: string | null;
}

function translateDistribution(items: DistributionItem[], t: (key: string) => string) {
  const nameMap: Record<string, string> = {
    "男": t("demographics.gender.male"),
    "女": t("demographics.gender.female"),
    "保密": t("demographics.gender.secret"),
    "未知": t("demographics.unknown"),
    "非大会员": t("demographics.vip.nonVip"),
    "月度大会员": t("demographics.vip.monthly"),
    "年度大会员": t("demographics.vip.annual"),
    LV0: "LV0",
    LV1: "LV1",
    LV2: "LV2",
    LV3: "LV3",
    LV4: "LV4",
    LV5: "LV5",
    LV6: "LV6",
  };

  return items.map((item) => ({
    ...item,
    name: nameMap[item.name] ?? item.name,
  }));
}

function buildPieOption(title: string, items: DistributionItem[], isDark: boolean) {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      textStyle: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
    },
    title: {
      text: title,
      left: "center",
      top: 0,
      textStyle: { color: isDark ? "#f3f4f6" : "#111827", fontSize: 13, fontWeight: 500 },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "45%"],
        label: { formatter: "{d}%", color: isDark ? "#d1d5db" : "#374151", fontSize: 11 },
        data: items,
      },
    ],
  };
}

function buildBarOption(title: string, items: DistributionItem[], isDark: boolean) {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    title: {
      text: title,
      left: "center",
      top: 0,
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
    series: [
      {
        type: "bar",
        data: items.map((item) => item.value),
        itemStyle: { color: "#6366f1" },
        barMaxWidth: 42,
      },
    ],
  };
}

export default function UserDemographicsPanel({ data, loading = false, error = null }: UserDemographicsPanelProps) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const vipItems = useMemo(() => translateDistribution(data?.vip_ratio ?? [], t), [data?.vip_ratio, t]);
  const genderItems = useMemo(() => translateDistribution(data?.gender_ratio ?? [], t), [data?.gender_ratio, t]);
  const levelItems = useMemo(() => translateDistribution(data?.level_distribution ?? [], t), [data?.level_distribution, t]);

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
            {t("demographics.uniqueUsers", { count: data.total_unique_users })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border/60 p-2">
          <ReactECharts option={buildPieOption(t("demographics.vipRatio"), vipItems, isDark)} style={{ height: 260 }} />
        </div>
        <div className="rounded-lg border border-border/60 p-2">
          <ReactECharts option={buildPieOption(t("demographics.genderRatio"), genderItems, isDark)} style={{ height: 260 }} />
        </div>
        <div className="rounded-lg border border-border/60 p-2">
          <ReactECharts option={buildBarOption(t("demographics.levelDistribution"), levelItems, isDark)} style={{ height: 260 }} />
        </div>
      </div>
    </div>
  );
}

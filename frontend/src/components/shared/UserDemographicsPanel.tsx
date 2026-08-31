import { useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  UserDemographicsResponse,
  DistributionItem,
  DemographicsFilter,
  UserRecord,
} from "@/types";
import { createEmptyFilter, isFilterEmpty } from "@/types";
import { Column, Columns } from "@/components/proof/Sheet";
import RankedBars, { type RankedItem } from "@/components/proof/RankedBars";
import { Inking, NoInk } from "@/components/proof/States";
import { Button } from "@/components/ui/button";
import { formatExact } from "@/lib/format";

interface UserDemographicsPanelProps {
  data: UserDemographicsResponse | null;
  loading?: boolean;
  error?: string | null;
  filter: DemographicsFilter;
  onFilterChange: (filter: DemographicsFilter) => void;
}

type Dimension = keyof DemographicsFilter;

const DIMENSIONS: Dimension[] = ["gender", "vip", "level", "location"];

const GENDER_ORDER = ["男", "女", "保密", "未知"];
const VIP_ORDER = ["非大会员", "月度大会员", "年度大会员", "未知"];
const LEVEL_ORDER = ["LV0", "LV1", "LV2", "LV3", "LV4", "LV5", "LV6", "未知"];

/** Backend values are Simplified Chinese; the sheet prints them in the UI language. */
function displayName(raw: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    男: t("demographics.gender.male"),
    女: t("demographics.gender.female"),
    保密: t("demographics.gender.secret"),
    未知: t("demographics.unknown"),
    非大会员: t("demographics.vip.nonVip"),
    月度大会员: t("demographics.vip.monthly"),
    年度大会员: t("demographics.vip.annual"),
  };
  return map[raw] ?? raw;
}

function filtersEqual(a: DemographicsFilter, b: DemographicsFilter): boolean {
  return DIMENSIONS.every((key) => {
    const aa = a[key];
    const bb = b[key];
    return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
  });
}

function applyFilters(
  users: UserRecord[],
  filter: DemographicsFilter,
  exclude?: Dimension,
): UserRecord[] {
  return users.filter((u) =>
    DIMENSIONS.every((dim) => {
      if (dim === exclude) return true;
      const selected = filter[dim];
      if (selected.length === 0) return true;
      const val = dim === "location" ? (u.location ?? "") : u[dim];
      return selected.includes(val);
    }),
  );
}

function computeDistribution(
  users: UserRecord[],
  dimension: Dimension,
  order: string[],
): DistributionItem[] {
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

/**
 * 受眾維度 —— the sheet's one continuous axis. Selecting values here re-sets the
 * word tables downstream; the masthead prints the resulting 印次.
 */
export default function UserDemographicsPanel({
  data,
  loading = false,
  error = null,
  filter,
  onFilterChange,
}: UserDemographicsPanelProps) {
  const { t, i18n } = useTranslation();
  const users = useMemo(() => data?.users ?? [], [data]);

  // React's "adjust state during render" pattern: the staged selection follows
  // the confirmed filter whenever the parent replaces it, without an effect.
  const [pending, setPending] = useState<DemographicsFilter>(filter);
  const [syncedFilter, setSyncedFilter] = useState<DemographicsFilter>(filter);
  if (syncedFilter !== filter) {
    setSyncedFilter(filter);
    setPending(filter);
  }

  const hasPending = !isFilterEmpty(pending);
  const hasConfirmed = !isFilterEmpty(filter);
  const pendingDiffers = !filtersEqual(pending, filter);

  const toggle = useCallback((dimension: Dimension, raw: string) => {
    setPending((prev) => {
      const current = prev[dimension];
      return {
        ...prev,
        [dimension]: current.includes(raw)
          ? current.filter((v) => v !== raw)
          : [...current, raw],
      };
    });
  }, []);

  /** Each dimension is cross-filtered by the others, never by itself. */
  const distribution = useCallback(
    (dimension: Dimension, order: string[], fallback: DistributionItem[]): RankedItem[] => {
      const source =
        hasConfirmed && users.length
          ? computeDistribution(applyFilters(users, filter, dimension), dimension, order)
          : fallback;
      const items = source.map((i) => ({
        name: displayName(i.name, t),
        value: i.value,
        raw: i.name,
      }));
      return dimension === "location" ? items.sort((a, b) => b.value - a.value) : items;
    },
    [users, filter, hasConfirmed, t],
  );

  const gender = useMemo(
    () => distribution("gender", GENDER_ORDER, data?.gender_ratio ?? []),
    [distribution, data],
  );
  const vip = useMemo(() => distribution("vip", VIP_ORDER, data?.vip_ratio ?? []), [distribution, data]);
  const level = useMemo(
    () => distribution("level", LEVEL_ORDER, data?.level_distribution ?? []),
    [distribution, data],
  );
  const location = useMemo(
    () => distribution("location", [], data?.location_distribution ?? []),
    [distribution, data],
  );

  const count = useMemo(() => {
    const active = pendingDiffers && hasPending ? pending : filter;
    if (isFilterEmpty(active) || !users.length) return data?.total_unique_users ?? 0;
    return applyFilters(users, active).length;
  }, [users, filter, pending, pendingDiffers, hasPending, data?.total_unique_users]);

  if (loading) return <Inking className="py-16" />;
  if (error) return <p className="py-16 text-center text-note text-mark">{error}</p>;
  if (!data || data.total_unique_users === 0) return <NoInk className="py-16" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-note text-ink-2">
          {hasConfirmed || (pendingDiffers && hasPending)
            ? t("demographics.filtered", {
                n: formatExact(count, i18n.language),
                total: formatExact(data.total_unique_users, i18n.language),
              })
            : t("demographics.uniqueUsers", {
                n: formatExact(data.total_unique_users, i18n.language),
              })}
        </p>
        <div className="flex items-center gap-2">
          {pendingDiffers && (
            <Button variant="default" size="sm" onClick={() => onFilterChange({ ...pending })}>
              {t("demographics.applyFilter")}
            </Button>
          )}
          {(hasPending || hasConfirmed) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const empty = createEmptyFilter();
                setPending(empty);
                onFilterChange(empty);
              }}
            >
              {t("demographics.clearFilter")}
            </Button>
          )}
        </div>
      </div>

      <Columns className="sm:grid-cols-2 xl:grid-cols-4">
        <Column label={t("demographics.genderRatio")}>
          <RankedBars items={gender} selected={pending.gender} onToggle={(r) => toggle("gender", r)} />
        </Column>
        <Column label={t("demographics.vipRatio")}>
          <RankedBars items={vip} selected={pending.vip} onToggle={(r) => toggle("vip", r)} />
        </Column>
        <Column label={t("demographics.levelDistribution")}>
          <RankedBars items={level} selected={pending.level} onToggle={(r) => toggle("level", r)} />
        </Column>
        {location.length > 0 && (
          <Column label={t("demographics.locationDistribution")}>
            <RankedBars
              items={location}
              selected={pending.location}
              onToggle={(r) => toggle("location", r)}
            />
          </Column>
        )}
      </Columns>
    </div>
  );
}

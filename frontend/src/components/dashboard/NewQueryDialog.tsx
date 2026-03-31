import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface NewQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFetchStarted: () => void;
}

type Preset = "7d" | "30d" | "3m" | "6m" | "1y" | "all";

function getPresetDates(preset: Preset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "3m":
      start.setMonth(end.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(end.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(end.getFullYear() - 1);
      break;
    case "all":
      start.setFullYear(2009, 6, 7); // Bilibili founding date
      break;
  }

  return { start: fmt(start), end: fmt(end) };
}

export default function NewQueryDialog({
  open,
  onOpenChange,
  onFetchStarted,
}: NewQueryDialogProps) {
  const { t } = useTranslation();
  const [uid, setUid] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [sessdataStatus, setSessdataStatus] = useState<"checking" | "valid" | "invalid" | "missing" | null>(null);

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    async function checkSessdata() {
      setSessdataStatus("checking");
      try {
        const settings = await api.getSettings();
        if (!ignore) {
          if (!settings.sessdata) {
            setSessdataStatus("missing");
            return;
          }

          // Test SESSDATA validity
          const testResult = await api.testSessdata(settings.sessdata);
          if (!ignore) {
            setSessdataStatus(testResult.status === "ok" ? "valid" : "invalid");
          }
        }
      } catch {
        if (!ignore) {
          setSessdataStatus("invalid");
        }
      }
    }

    void checkSessdata();
    return () => {
      ignore = true;
    };
  }, [open]);

  const presets: Preset[] = ["7d", "30d", "3m", "6m", "1y", "all"];

  function handlePreset(preset: Preset) {
    setActivePreset(preset);
    const { start, end } = getPresetDates(preset);
    setStartDate(start);
    setEndDate(end);
  }

  function resetForm() {
    setUid("");
    setStartDate("");
    setEndDate("");
    setActivePreset(null);
    setSessdataStatus(null);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  async function handleSubmit() {
    if (!uid || !startDate || !endDate) return;
    setLoading(true);
    try {
      await api.fetch(Number(uid), startDate, endDate);
      onFetchStarted();
      handleDialogOpenChange(false);
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    handleDialogOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("app.newQuery")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {sessdataStatus === "missing" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {t("query.sessdataWarning")}
            </div>
          )}
          {sessdataStatus === "invalid" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {t("query.sessdataInvalid")}
            </div>
          )}

          {/* UID input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="uid-input">{t("query.uid")}</Label>
            <Input
              id="uid-input"
              type="number"
              placeholder="e.g. 12345678"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            />
          </div>

          {/* Date preset buttons */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("query.dateRange")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={
                    "rounded px-2.5 py-1 text-xs font-medium border transition-colors " +
                    (activePreset === preset
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-background text-foreground border-border hover:bg-muted")
                  }
                >
                  {t(`query.preset.${preset}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset(null);
                }}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset(null);
                }}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !uid || !startDate || !endDate}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {loading ? t("common.loading") : t("common.fetchData")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

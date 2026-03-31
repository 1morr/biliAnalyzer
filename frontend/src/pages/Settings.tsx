import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeIcon, EyeOffIcon, CheckCircleIcon, XCircleIcon, Loader2Icon } from "lucide-react";
import { api } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import i18n from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Theme = "light" | "dark" | "system";

const MASK = "***";

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={visible ? "Hide" : "Show"}
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  // Form fields
  const [sessdata, setSessdata] = useState(MASK);
  const [aiBaseUrl, setAiBaseUrl] = useState("https://api.openai.com/v1");
  const [aiApiKey, setAiApiKey] = useState(MASK);
  const [aiModel, setAiModel] = useState("gpt-4o");

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sessdataTestStatus, setSessdataTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [sessdataTestMessage, setSessdataTestMessage] = useState<string>("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string>("");

  const [lang, setLang] = useState<string>(localStorage.getItem("lang") || "zh");

  // Fetch current settings on mount
  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setSessdata(s.sessdata ? MASK : "");
        setAiBaseUrl(s.ai_base_url || "https://api.openai.com/v1");
        setAiApiKey(s.ai_api_key ? MASK : "");
        setAiModel(s.ai_model || "gpt-4o");
      })
      .catch(() => {
        // keep defaults
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSessdataChange(value: string) {
    setSessdata(value);
    setSessdataTestStatus("idle");
    setSessdataTestMessage("");
  }

  // Save server-side settings
  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const payload: Record<string, string> = {
        ai_base_url: aiBaseUrl,
        ai_model: aiModel,
      };
      // Only send if user changed from mask
      if (sessdata !== MASK) payload.sessdata = sessdata;
      if (aiApiKey !== MASK) payload.ai_api_key = aiApiKey;

      await api.updateSettings(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSessdata() {
    setSessdataTestStatus("loading");
    setSessdataTestMessage("");
    try {
      const res = await api.testSessdata(sessdata);
      const isOk = res.status === "ok";
      setSessdataTestStatus(isOk ? "ok" : "error");
      setSessdataTestMessage(isOk ? (res.message || "OK") : (res.message || "Validation failed"));
    } catch (e) {
      setSessdataTestStatus("error");
      setSessdataTestMessage(e instanceof Error ? e.message : "Validation failed");
    }
  }

  // Test AI connection
  async function handleTestConnection() {
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await api.testAi();
      const isOk = res.status === "ok";
      setTestStatus(isOk ? "ok" : "error");
      setTestMessage(isOk ? (res.message || "OK") : (res.message || "Connection failed"));
    } catch (e) {
      setTestStatus("error");
      setTestMessage(e instanceof Error ? e.message : "Connection failed");
    }
  }

  // Language change
  function handleLangChange(value: string | null) {
    if (!value) return;
    setLang(value);
    i18n.changeLanguage(value);
    localStorage.setItem("lang", value);
  }

  // Theme change
  function handleThemeChange(values: string[]) {
    if (values.length === 0) return;
    setTheme(values[0] as Theme);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

      {/* ── Section 1: Bilibili Connection ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.bilibili")}</CardTitle>
          <CardDescription>{t("settings.sessdataHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sessdata">{t("settings.sessdata")}</Label>
            <PasswordInput
              id="sessdata"
              value={sessdata}
              onChange={handleSessdataChange}
              placeholder="SESSDATA"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestSessdata}
              disabled={sessdataTestStatus === "loading"}
            >
              {sessdataTestStatus === "loading" && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              {t("settings.validateSessdata")}
            </Button>
            {sessdataTestStatus === "ok" && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircleIcon className="size-4" />
                {sessdataTestMessage || "OK"}
              </span>
            )}
            {sessdataTestStatus === "error" && (
              <span className="flex items-center gap-1 text-sm text-red-500">
                <XCircleIcon className="size-4" />
                {sessdataTestMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: AI Configuration ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.aiConfig")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-base-url">{t("settings.baseUrl")}</Label>
            <Input
              id="ai-base-url"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-api-key">{t("settings.apiKey")}</Label>
            <PasswordInput
              id="ai-api-key"
              value={aiApiKey}
              onChange={(v) => setAiApiKey(v)}
              placeholder="sk-..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-model">{t("settings.model")}</Label>
            <Input
              id="ai-model"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="gpt-4o"
            />
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testStatus === "loading"}
            >
              {testStatus === "loading" && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              {t("settings.testConnection")}
            </Button>
            {testStatus === "ok" && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircleIcon className="size-4" />
                {testMessage || "OK"}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1 text-sm text-red-500">
                <XCircleIcon className="size-4" />
                {testMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Appearance ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("settings.theme")}</Label>
            <ToggleGroup
              value={[theme]}
              onValueChange={handleThemeChange}
              variant="outline"
            >
              <ToggleGroupItem value="light">{t("settings.light")}</ToggleGroupItem>
              <ToggleGroupItem value="dark">{t("settings.dark")}</ToggleGroupItem>
              <ToggleGroupItem value="system">{t("settings.system")}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("settings.language")}</Label>
            <Select value={lang} onValueChange={handleLangChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Data Management ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.data")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" />}>
              {t("settings.clearAll")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("settings.clearAll")}</DialogTitle>
                <DialogDescription>{t("settings.clearConfirm")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {t("common.cancel")}
                </DialogClose>
                <DialogClose
                  render={
                    <Button
                      variant="destructive"
                      onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                      }}
                    />
                  }
                >
                  {t("common.confirm")}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* ── Save button ── */}
      <div className="flex items-center gap-3 pb-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2Icon className="size-4 animate-spin" />}
          {t("settings.save")}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircleIcon className="size-4" />
            {t("settings.saved")}
          </span>
        )}
        {saveError && (
          <span className="flex items-center gap-1 text-sm text-red-500">
            <XCircleIcon className="size-4" />
            {saveError}
          </span>
        )}
      </div>
    </div>
  );
}

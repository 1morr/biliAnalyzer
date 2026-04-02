import { SunIcon, MoonIcon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import type { QueryDetail } from "@/types";

interface TopBarProps {
  queryDetail?: QueryDetail;
  onAiClick?: () => void;
}

export default function TopBar({ queryDetail, onAiClick }: TopBarProps) {
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: query info or page title */}
      <div className="flex items-center gap-3 text-sm">
        {queryDetail ? (
          <>
            <span className="font-semibold text-foreground">
              UID: {queryDetail.uid}
            </span>
            <span className="text-muted-foreground">
              {queryDetail.start_date} → {queryDetail.end_date}
            </span>
            <span className="text-muted-foreground">
              {queryDetail.video_count} videos
            </span>
          </>
        ) : (
          <span className="font-semibold text-foreground">BiliAnalyzer</span>
        )}
      </div>

      {/* Right: AI Analysis button + theme toggle */}
      <div className="flex items-center gap-2">
        {onAiClick && (
          <Button
            onClick={onAiClick}
            size="sm"
            className="bg-gradient-to-r from-purple-500 to-purple-700 text-white hover:from-purple-600 hover:to-purple-800 border-0"
          >
            AI Analysis
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
        </Button>
      </div>
    </header>
  );
}

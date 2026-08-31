import { Outlet } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { AppContext } from "@/lib/app-context";

export default function AppLayout() {
  const [indexOpen, setIndexOpen] = useState(false);
  const openIndex = useCallback(() => setIndexOpen(true), []);
  const context = useMemo<AppContext>(() => ({ openIndex }), [openIndex]);

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      {/* 檢字架 —— the manuscript index. Fixed beside the sheet on desktop. */}
      <div className="hidden w-[236px] shrink-0 border-r border-rule-strong sm:block">
        <Sidebar />
      </div>

      <Sheet open={indexOpen} onOpenChange={setIndexOpen}>
        <SheetContent side="left" className="w-[264px] p-0 sm:max-w-[264px]" showCloseButton={false}>
          <Sidebar onNavigate={() => setIndexOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* The open note reserves its margin here; see proof/Marginalia.tsx. */}
      <main
        className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden transition-[padding] duration-220 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ paddingRight: "var(--note-margin, 0px)" }}
      >
        <Outlet context={context} />
      </main>
    </div>
  );
}

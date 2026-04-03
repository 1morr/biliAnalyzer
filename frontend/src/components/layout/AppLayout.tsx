import { Outlet, useOutletContext } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { QueryDetail } from "@/types";

export interface DashboardContext {
  setQueryDetail: (q: QueryDetail | undefined) => void;
  setOnAiClick: (fn: (() => void) | undefined) => void;
}

export function useDashboardContext() {
  return useOutletContext<DashboardContext>();
}

export default function AppLayout() {
  const [queryDetail, setQueryDetail] = useState<QueryDetail | undefined>(undefined);
  const [onAiClick, setOnAiClickState] = useState<(() => void) | undefined>(undefined);

  // Stable setter — avoids infinite re-render loops in child effects
  const setOnAiClick = useCallback((fn: (() => void) | undefined) => {
    setOnAiClickState(fn ? () => fn : undefined);
  }, []);

  const context = useMemo<DashboardContext>(
    () => ({ setQueryDetail, setOnAiClick }),
    [setQueryDetail, setOnAiClick],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Fixed-width sidebar */}
      <Sidebar />

      {/* Main content: TopBar + routed page */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar queryDetail={queryDetail} onAiClick={onAiClick} />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}

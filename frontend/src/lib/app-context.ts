import { useOutletContext } from "react-router-dom";

export interface AppContext {
  /** Opens the manuscript index as an off-canvas sheet on small screens. */
  openIndex: () => void;
}

export function useAppContext() {
  return useOutletContext<AppContext>();
}

import type { QuerySummary, QueryDetail, VideoDetail, PaginatedVideos, StatsSummary, TrendPoint, InteractionData, VideoComparison, SettingsResponse } from "@/types";

const BASE = import.meta.env.VITE_API_BASE || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

export const api = {
  fetch: (uid: number, start_date: string, end_date: string) =>
    request<{ query_id: number; status: string }>("/fetch", {
      method: "POST", body: JSON.stringify({ uid, start_date, end_date }),
    }),
  getQueries: () => request<QuerySummary[]>("/queries"),
  getQuery: (id: number) => request<QueryDetail>(`/queries/${id}`),
  deleteQuery: (id: number) => request(`/queries/${id}`, { method: "DELETE" }),
  getVideos: (queryId: number, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<PaginatedVideos>(`/queries/${queryId}/videos?${qs}`);
  },
  getVideo: (bvid: string) => request<VideoDetail>(`/videos/${bvid}`),
  getStatsSummary: (queryId: number) => request<StatsSummary>(`/queries/${queryId}/stats/summary`),
  getTrend: (queryId: number) => request<TrendPoint[]>(`/queries/${queryId}/stats/trend`),
  getInteraction: (queryId: number) => request<InteractionData>(`/queries/${queryId}/stats/interaction`),
  getComparison: (bvid: string, queryId: number) =>
    request<VideoComparison>(`/videos/${bvid}/stats/comparison?query_id=${queryId}`),
  getSettings: () => request<SettingsResponse>("/settings"),
  updateSettings: (data: Partial<SettingsResponse>) =>
    request<SettingsResponse>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  testAi: () => request<{ status: string; message?: string }>("/settings/test-ai", { method: "POST" }),
  wordcloudUrl: (queryId: number, type: string) => `${BASE}/queries/${queryId}/wordcloud/${type}`,
  videoWordcloudUrl: (bvid: string, type: string) => `${BASE}/videos/${bvid}/wordcloud/${type}`,
  aiAnalyzeUrl: (queryId: number) => `${BASE}/queries/${queryId}/ai/analyze`,
};

import type { QuerySummary, QueryDetail, VideoDetail, PaginatedVideos, StatsSummary, TrendPoint, InteractionData, VideoComparison, SettingsResponse, WordFrequencyResponse, WordDetailResponse, UserDemographicsResponse, DemographicsFilter } from "@/types";

const BASE = import.meta.env.VITE_API_BASE || "/api";

function buildFilterParams(filter?: DemographicsFilter): string {
  if (!filter) return "";
  const params = new URLSearchParams();
  if (filter.gender.length) params.set("gender", filter.gender.join(","));
  if (filter.vip.length) params.set("vip", filter.vip.join(","));
  if (filter.level.length) params.set("level", filter.level.join(","));
  if (filter.location.length) params.set("location", filter.location.join(","));
  const qs = params.toString();
  return qs ? `${qs}` : "";
}

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
  getQueryDemographics: (queryId: number) =>
    request<UserDemographicsResponse>(`/queries/${queryId}/stats/demographics`),
  getComparison: (bvid: string, queryId: number) =>
    request<VideoComparison>(`/videos/${bvid}/stats/comparison?query_id=${queryId}`),
  getVideoDemographics: (bvid: string) =>
    request<UserDemographicsResponse>(`/videos/${bvid}/stats/demographics`),
  getSettings: () => request<SettingsResponse>("/settings"),
  updateSettings: (data: Partial<SettingsResponse>) =>
    request<SettingsResponse>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  testSessdata: (sessdata: string) =>
    request<{ status: string; message?: string }>("/settings/test-sessdata", {
      method: "POST",
      body: JSON.stringify({ sessdata }),
    }),
  testAi: (data: Pick<SettingsResponse, "ai_base_url" | "ai_api_key" | "ai_model">) =>
    request<{ status: string; message?: string }>("/settings/test-ai", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWordFrequency: (queryId: number, type: string, filter?: DemographicsFilter) => {
    const fp = buildFilterParams(filter);
    return request<WordFrequencyResponse>(`/queries/${queryId}/wordcloud/${type}${fp ? `?${fp}` : ""}`);
  },
  getVideoWordFrequency: (bvid: string, type: string, filter?: DemographicsFilter) => {
    const fp = buildFilterParams(filter);
    return request<WordFrequencyResponse>(`/videos/${bvid}/wordcloud/${type}${fp ? `?${fp}` : ""}`);
  },
  getWordDetail: (queryId: number, type: string, word: string, filter?: DemographicsFilter) => {
    const fp = buildFilterParams(filter);
    const sep = fp ? `&${fp}` : "";
    return request<WordDetailResponse>(`/queries/${queryId}/wordcloud/${type}/detail?word=${encodeURIComponent(word)}${sep}`);
  },
  getVideoWordDetail: (bvid: string, type: string, word: string, filter?: DemographicsFilter) => {
    const fp = buildFilterParams(filter);
    const sep = fp ? `&${fp}` : "";
    return request<WordDetailResponse>(`/videos/${bvid}/wordcloud/${type}/detail?word=${encodeURIComponent(word)}${sep}`);
  },
  aiAnalyzeUrl: (queryId: number) => `${BASE}/queries/${queryId}/ai/analyze`,
};

import type { QuerySummary, QueryDetail, VideoDetail, PaginatedVideos, StatsSummary, TrendPoint, InteractionData, VideoComparison, SettingsResponse, WordFrequencyResponse, WordDetailResponse, UserDemographicsResponse, DemographicsFilter, SentimentOverview, SentimentTrendPoint, SentimentWordItem, DemographicSentimentCell } from "@/types";

const BASE = import.meta.env.VITE_API_BASE || "/api";

function buildFilterParams(filter?: DemographicsFilter, prefix: "?" | "&" = "?"): string {
  if (!filter) return "";
  const params = new URLSearchParams();
  if (filter.gender.length) params.set("gender", filter.gender.join(","));
  if (filter.vip.length) params.set("vip", filter.vip.join(","));
  if (filter.level.length) params.set("level", filter.level.join(","));
  if (filter.location.length) params.set("location", filter.location.join(","));
  const qs = params.toString();
  return qs ? `${prefix}${qs}` : "";
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
  getWordFrequency: (queryId: number, type: string, filter?: DemographicsFilter) =>
    request<WordFrequencyResponse>(`/queries/${queryId}/wordcloud/${type}${buildFilterParams(filter)}`),
  getVideoWordFrequency: (bvid: string, type: string, filter?: DemographicsFilter) =>
    request<WordFrequencyResponse>(`/videos/${bvid}/wordcloud/${type}${buildFilterParams(filter)}`),
  getWordDetail: (queryId: number, type: string, word: string, filter?: DemographicsFilter) =>
    request<WordDetailResponse>(`/queries/${queryId}/wordcloud/${type}/detail?word=${encodeURIComponent(word)}${buildFilterParams(filter, "&")}`),
  getVideoWordDetail: (bvid: string, type: string, word: string, filter?: DemographicsFilter) =>
    request<WordDetailResponse>(`/videos/${bvid}/wordcloud/${type}/detail?word=${encodeURIComponent(word)}${buildFilterParams(filter, "&")}`),
  aiAnalyzeUrl: (queryId: number) => `${BASE}/queries/${queryId}/ai/analyze`,

  // Sentiment analysis
  getSentimentOverview: (queryId: number) =>
    request<SentimentOverview>(`/queries/${queryId}/sentiment/overview`),
  getSentimentTrend: (queryId: number) =>
    request<SentimentTrendPoint[]>(`/queries/${queryId}/sentiment/trend`),
  getSentimentWordcloud: (queryId: number, source: string, limit = 100) =>
    request<SentimentWordItem[]>(`/queries/${queryId}/sentiment/wordcloud/${source}?limit=${limit}`),
  getSentimentDemographics: (queryId: number) =>
    request<DemographicSentimentCell[]>(`/queries/${queryId}/sentiment/demographics`),
  triggerSentimentAnalysis: (queryId: number, force = false) =>
    request<{ status: string; message: string }>(`/queries/${queryId}/sentiment/analyze?force=${force}`, { method: "POST" }),

  // Video-level sentiment
  getVideoSentimentOverview: (bvid: string) =>
    request<SentimentOverview>(`/videos/${bvid}/sentiment/overview`),
  getVideoSentimentWordcloud: (bvid: string, source: string, limit = 100) =>
    request<SentimentWordItem[]>(`/videos/${bvid}/sentiment/wordcloud/${source}?limit=${limit}`),
  getVideoSentimentDemographics: (bvid: string) =>
    request<DemographicSentimentCell[]>(`/videos/${bvid}/sentiment/demographics`),
};

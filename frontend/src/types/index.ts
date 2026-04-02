export interface QuerySummary {
  id: number; uid: number; user_name: string | null;
  start_date: string; end_date: string; status: string;
  progress: string | null; video_count: number; total_views: number;
  created_at: string;
}

export interface QueryDetail extends QuerySummary {
  error_message: string | null;
  total_likes: number; total_coins: number; total_favorites: number;
  total_shares: number; total_danmaku: number; total_comments: number;
  sentiment_status: string | null;
}

export interface VideoStats {
  views: number; likes: number; coins: number; favorites: number;
  shares: number; danmaku_count: number; comment_count: number;
  interaction_rate: number;
}

export interface VideoSummary {
  bvid: string; title: string; cover_url: string | null;
  duration: number; published_at: string | null;
  tags: string | null; stats: VideoStats;
}

export interface VideoDetail extends VideoSummary {
  aid: number | null; cid: number | null;
  description: string | null;
  has_danmaku: boolean; has_subtitle: boolean;
}

export interface PaginatedVideos {
  items: VideoSummary[]; total: number;
  page: number; page_size: number; total_pages: number;
}

export interface StatsSummary {
  total_views: number; total_likes: number; total_coins: number;
  total_favorites: number; total_shares: number; total_danmaku: number;
  total_comments: number; video_count: number;
}

export interface TrendPoint { date: string; views: number; }
export interface InteractionData { likes: number; coins: number; favorites: number; shares: number; }
export interface VideoComparison {
  metrics: string[]; video_values: number[];
  average_values: number[]; percentage_diff: number[];
  max_values: number[];
}

export interface DistributionItem {
  name: string;
  value: number;
}

export interface UserDemographicsResponse {
  total_unique_users: number;
  uid_backed_users: number;
  username_fallback_users: number;
  vip_ratio: DistributionItem[];
  gender_ratio: DistributionItem[];
  level_distribution: DistributionItem[];
  location_distribution: DistributionItem[];
  users: UserRecord[];
}

export interface UserRecord {
  gender: string;
  vip: string;
  level: string;
  location: string | null;
}

export interface DemographicsFilter {
  gender: string[];
  vip: string[];
  level: string[];
  location: string[];
}

export function createEmptyFilter(): DemographicsFilter {
  return { gender: [], vip: [], level: [], location: [] };
}

export function isFilterEmpty(f: DemographicsFilter): boolean {
  return f.gender.length === 0 && f.vip.length === 0 && f.level.length === 0 && f.location.length === 0;
}

export interface SettingsResponse {
  sessdata: string; ai_base_url: string;
  ai_api_key: string; ai_model: string;
  proxy_list: string;
}

export interface WordFrequencyItem {
  name: string;
  value: number;
}

export interface WordFrequencyResponse {
  words: WordFrequencyItem[];
}

export interface SnippetItem {
  text: string;
  user: string | null;
  source: string | null; // "danmaku" | "comment" | "title" | "tag" | "subtitle" | null
}

export interface WordContextVideo {
  bvid: string;
  title: string;
  count: number;
  snippets: SnippetItem[];
}

export interface WordDetailResponse {
  word: string;
  total_count: number;
  videos: WordContextVideo[];
}

// Sentiment Analysis Types

export interface SentimentDistribution {
  avg_score: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  count: number;
}

export interface SentimentOverview {
  status: string | null;
  danmaku: SentimentDistribution | null;
  comment: SentimentDistribution | null;
}

export interface SentimentTrendPoint {
  date: string;
  danmaku_avg: number | null;
  comment_avg: number | null;
  danmaku_positive_pct: number | null;
  comment_positive_pct: number | null;
}

export interface SentimentWordItem {
  name: string;
  value: number;
  avg_score: number;
  label: string;
}

export interface DemographicSentimentCell {
  dimension: string;
  category: string;
  avg_score: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  count: number;
}

export interface SentimentContextItem {
  text: string;
  user: string | null;
  score: number;
  label: string;
  source: string | null;
}

export interface SentimentContextResponse {
  total_count: number;
  items: SentimentContextItem[];
}

// AI Conversation Types

export interface AIPreset {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}

export interface AIConversation {
  id: number;
  preset: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
  message_count: number;
}

export interface ToolCallInfo {
  name: string;
  arguments: Record<string, unknown>;
  result?: string | null;
}

export interface AIMessageItem {
  id: number;
  role: "user" | "assistant";
  content: string | null;
  tool_calls?: ToolCallInfo[] | null;
  created_at: string;
}

export interface AIConversationDetail {
  id: number;
  preset: string;
  title: string | null;
  query_id: number | null;
  bvid: string | null;
  messages: AIMessageItem[];
}

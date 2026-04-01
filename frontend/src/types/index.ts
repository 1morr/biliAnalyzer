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

export const EMPTY_FILTER: DemographicsFilter = {
  gender: [], vip: [], level: [], location: [],
};

export interface SettingsResponse {
  sessdata: string; ai_base_url: string;
  ai_api_key: string; ai_model: string;
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

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

export interface SettingsResponse {
  sessdata: string; ai_base_url: string;
  ai_api_key: string; ai_model: string;
}

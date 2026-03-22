export type RumbleEventType =
  | 'video.watch_started'
  | 'video.watch_progress'
  | 'video.watch_completed'
  | 'video.liked'
  | 'video.comment_posted'
  | 'livestream.started'
  | 'livestream.milestone'
  | 'livestream.super_chat'
  | 'livestream.ended'
  | 'creator.subscriber_goal'
  | 'tip.completed';

export interface RumbleBaseEvent {
  event_id: string;
  event_type: RumbleEventType;
  timestamp: string;
  creator_id: string;
  creator_rumble_handle: string;
  video_id?: string;
  video_title?: string;
  video_duration_seconds?: number;
}

export interface WatchProgressEvent extends RumbleBaseEvent {
  event_type: 'video.watch_progress' | 'video.watch_completed';
  viewer_id: string;
  watch_percent: number;
  watch_seconds: number;
  session_id: string;
}

export interface LivestreamMilestoneEvent extends RumbleBaseEvent {
  event_type: 'livestream.milestone';
  milestone_type: 'viewer_count' | 'subscriber_count' | 'tip_total';
  milestone_value: number;
}

export interface SuperChatEvent extends RumbleBaseEvent {
  event_type: 'livestream.super_chat';
  viewer_id: string;
  message: string;
  amount_usd_cents: number;
  token: 'USDT' | 'XAUT' | 'BTC';
}

export interface RumbleTipEvent extends RumbleBaseEvent {
  event_type: 'tip.completed';
  viewer_id: string;
  amount_base_units: string;
  token: 'USDT' | 'XAUT' | 'BTC';
  tx_hash: string;
  chain: string;
}

export type RumbleEvent =
  | RumbleBaseEvent
  | WatchProgressEvent
  | LivestreamMilestoneEvent
  | SuperChatEvent
  | RumbleTipEvent;

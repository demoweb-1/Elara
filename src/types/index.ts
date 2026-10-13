export type MemoryCategory =
  | 'preferences'
  | 'dislikes'
  | 'important_dates'
  | 'habits_routines'
  | 'communication_preferences'
  | 'gifts_experiences'
  | 'meaningful_moments'
  | 'goals_plans';

export interface Memory {
  id: string;
  user_id: string;
  category: MemoryCategory;
  content: string;
  context: string | null;
  confidence: number;
  source_message_id: string | null;
  is_private: boolean;
  last_confirmed_at: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposedMemory {
  category: MemoryCategory;
  content: string;
  context: string | null;
  confidence: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  proposed_memories: ProposedMemory[] | null;
  memories_reviewed: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CoupleConnection {
  id: string;
  user_a: string;
  user_b: string | null;
  invitation_status: 'pending' | 'accepted' | 'declined' | 'disconnected';
  invited_by: string;
  invited_email: string;
  accepted_at: string | null;
  disconnected_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryShare {
  id: string;
  memory_id: string;
  owner_id: string;
  recipient_id: string;
  connection_id: string;
  status: 'active' | 'revoked';
  shared_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  reminder_type: 'birthday' | 'anniversary' | 'occasion' | 'plan' | 'general';
  due_at: string;
  timezone: string;
  completed: boolean;
  completed_at: string | null;
  advance_notice_days: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  onboarding_completed: boolean;
  partner_name: string;
  relationship_start_date: string | null;
  timezone: string;
  ai_consent: boolean;
  ai_consent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  reminder_notifications: boolean;
  memory_suggestions: boolean;
  partner_updates: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'plus';
  status: 'active' | 'cancelled' | 'expired';
  ai_request_count: number;
  ai_request_limit: number;
  ai_request_reset_at: string;
}

export interface SharedMemory extends Memory {
  owner_display_name?: string;
}

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preferences: 'Preferences & Favourites',
  dislikes: 'Dislikes',
  important_dates: 'Important Dates',
  habits_routines: 'Habits & Routines',
  communication_preferences: 'Communication',
  gifts_experiences: 'Gifts & Experiences',
  meaningful_moments: 'Meaningful Moments',
  goals_plans: 'Goals & Plans',
};

export const CATEGORY_EMOJIS: Record<MemoryCategory, string> = {
  preferences: '♡',
  dislikes: '✕',
  important_dates: '◇',
  habits_routines: '◐',
  communication_preferences: '✉',
  gifts_experiences: '✦',
  meaningful_moments: '★',
  goals_plans: '→',
};

export const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  preferences: 'text-burgundy',
  dislikes: 'text-error',
  important_dates: 'text-accent',
  habits_routines: 'text-success',
  communication_preferences: 'text-burgundy-light',
  gifts_experiences: 'text-accent',
  meaningful_moments: 'text-burgundy',
  goals_plans: 'text-success',
};

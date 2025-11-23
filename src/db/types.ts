// Database types

export interface Session {
  id: number;
  working_dir: string;
  session_hash: string;
  default_provider: string;
  default_model: string;
  api_key_hash: string | null;
  started_at: string;
  ended_at: string | null;
  last_activity: string;
  status: 'active' | 'completed' | 'archived';
  title: string | null;
  tags: string | null;
  metadata: string | null;
  user_id: string | null;
  // New fields from migration 002
  session_name: string | null;
  created_at: string | null;
  message_count: number;
  total_tokens: number;
  first_message_preview: string | null;
  last_message_preview: string | null;
  project_context: string | null;
  is_favorite: number;
}

/**
 * Enriched session list item with all metadata for display/search
 */
export interface SessionListItem {
  id: number;
  session_name: string | null;
  working_dir: string;
  default_provider: string;
  default_model: string;
  message_count: number;
  total_tokens: number;
  status: 'active' | 'completed' | 'archived';
  created_at: string | null;
  last_activity: string;
  first_message_preview: string | null;
  last_message_preview: string | null;
  is_favorite: boolean;
  project_context: string | null;
  // Computed fields
  age_days?: number;  // Days since creation
  last_activity_relative?: string;  // "2 hours ago"
}

export interface Message {
  id: number;
  session_id: number;
  type: string;
  role: string;
  content: string;
  content_type: string;
  provider: string;
  model: string;
  api_key_hash: string | null;
  timestamp: string;
  token_count: number;
  tool_calls: string | null;
  tool_call_id: string | null;
  is_streaming: boolean;
  parent_message_id: number | null;
}

export interface SessionInput {
  working_dir: string;
  session_hash: string;
  default_provider: string;
  default_model: string;
  api_key_hash?: string | null;
  title?: string | null;
  tags?: string | null;
  metadata?: string | null;
  user_id?: string | null;
}

export interface MessageInput {
  session_id: number;
  type: string;
  role: string;
  content: string;
  content_type?: string;
  provider: string;
  model: string;
  api_key_hash?: string | null;
  timestamp?: string;
  token_count?: number;
  tool_calls?: any;
  tool_call_id?: string | null;
  is_streaming?: boolean;
  parent_message_id?: number | null;
}

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

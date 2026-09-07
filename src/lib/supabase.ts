import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://zjhjnbgtrczkzkrxixvy.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqaGpuYmd0cmN6a3prcnhpeHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTI2MTIsImV4cCI6MjA5NDM4ODYxMn0.p91K4x39NtHQ8tDa9Lnacn0tSgbG1m6zh0HZgz9mPKI';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Profile = {
  id: string;
  full_name: string;
  credits: number;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
};

export type Candidate = {
  id: string;
  user_id: string;
  client_id: string | null;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  role: string | null;
  location: string | null;
  status: 'new' | 'contacted' | 'replied' | 'qualified' | 'archived';
  match_score: number;
  created_at: string;
  updated_at: string;
};

export type OutreachSequence = {
  id: string;
  user_id: string;
  candidate_id: string | null;
  channel: 'email' | 'linkedin';
  subject: string | null;
  message: string | null;
  status: 'draft' | 'active' | 'paused' | 'replied' | 'completed';
  sent_at: string | null;
  reply_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Integration = {
  id: string;
  user_id: string;
  provider: 'reply_io' | 'linkedin' | 'email';
  api_key: string | null;
  account_label: string | null;
  status: 'connected' | 'disconnected' | 'error';
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobSignal = {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  source: string;
  signal_type: 'NEW' | 'REPOST' | 'REOPENED' | 'AGING';
  location: string | null;
  score: number;
  created_at: string;
};

export type Activity = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  detail: string | null;
  created_at: string;
};

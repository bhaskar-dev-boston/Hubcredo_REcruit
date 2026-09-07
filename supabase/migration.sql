/*
  HubCredo Dashboard Schema Migration
  ===================================
  Run this in your Supabase SQL Editor (Dashboard > SQL > New Query).

  Creates all tables needed for the HubCredo dashboard:
  - profiles: user display name and credits
  - clients: tracked companies
  - candidates: people connected to clients
  - outreach_sequences: email and LinkedIn outreach
  - integrations: reply.io, LinkedIn, email API keys
  - job_signals: hiring signals from n8n
  - activities: recent workspace events

  All tables are owner-scoped (user_id = auth.uid()) with RLS enabled.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  credits integer NOT NULL DEFAULT 90 CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  industry text,
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
CREATE POLICY "clients_select_own" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "clients_insert_own" ON public.clients;
CREATE POLICY "clients_insert_own" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "clients_update_own" ON public.clients;
CREATE POLICY "clients_update_own" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "clients_delete_own" ON public.clients;
CREATE POLICY "clients_delete_own" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CANDIDATES
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  linkedin_url text,
  role text,
  location text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','replied','qualified','archived')),
  match_score integer NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidates_user_id_idx ON public.candidates(user_id);
CREATE INDEX IF NOT EXISTS candidates_client_id_idx ON public.candidates(client_id);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "candidates_select_own" ON public.candidates;
CREATE POLICY "candidates_select_own" ON public.candidates FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "candidates_insert_own" ON public.candidates;
CREATE POLICY "candidates_insert_own" ON public.candidates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "candidates_update_own" ON public.candidates;
CREATE POLICY "candidates_update_own" ON public.candidates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "candidates_delete_own" ON public.candidates;
CREATE POLICY "candidates_delete_own" ON public.candidates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- OUTREACH SEQUENCES
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','linkedin')),
  subject text,
  message text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','replied','completed')),
  sent_at timestamptz,
  reply_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sequences_user_id_idx ON public.outreach_sequences(user_id);
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sequences_select_own" ON public.outreach_sequences;
CREATE POLICY "sequences_select_own" ON public.outreach_sequences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "sequences_insert_own" ON public.outreach_sequences;
CREATE POLICY "sequences_insert_own" ON public.outreach_sequences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sequences_update_own" ON public.outreach_sequences;
CREATE POLICY "sequences_update_own" ON public.outreach_sequences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sequences_delete_own" ON public.outreach_sequences;
CREATE POLICY "sequences_delete_own" ON public.outreach_sequences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- INTEGRATIONS
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('reply_io','linkedin','email')),
  api_key text,
  account_label text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integrations_select_own" ON public.integrations;
CREATE POLICY "integrations_select_own" ON public.integrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "integrations_insert_own" ON public.integrations;
CREATE POLICY "integrations_insert_own" ON public.integrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "integrations_update_own" ON public.integrations;
CREATE POLICY "integrations_update_own" ON public.integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "integrations_delete_own" ON public.integrations;
CREATE POLICY "integrations_delete_own" ON public.integrations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- JOB SIGNALS
CREATE TABLE IF NOT EXISTS public.job_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'LinkedIn',
  signal_type text NOT NULL DEFAULT 'NEW' CHECK (signal_type IN ('NEW','REPOST','REOPENED','AGING')),
  location text,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signals_user_id_idx ON public.job_signals(user_id);
ALTER TABLE public.job_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signals_select_own" ON public.job_signals;
CREATE POLICY "signals_select_own" ON public.job_signals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "signals_insert_own" ON public.job_signals;
CREATE POLICY "signals_insert_own" ON public.job_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "signals_update_own" ON public.job_signals;
CREATE POLICY "signals_update_own" ON public.job_signals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "signals_delete_own" ON public.job_signals;
CREATE POLICY "signals_delete_own" ON public.job_signals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ACTIVITIES
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_user_id_created_at_idx ON public.activities(user_id, created_at DESC);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_select_own" ON public.activities;
CREATE POLICY "activities_select_own" ON public.activities FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;
CREATE POLICY "activities_insert_own" ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "activities_update_own" ON public.activities;
CREATE POLICY "activities_update_own" ON public.activities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "activities_delete_own" ON public.activities;
CREATE POLICY "activities_delete_own" ON public.activities FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CLIENT SOURCING RAW (n8n "Client Sourcing" branch writes here)
CREATE TABLE IF NOT EXISTS public.client_sourcing_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  company_linkedin_url text NOT NULL,
  linkedin_company_id text,
  company_name text,
  tagline text,
  about text,
  location_city text,
  location_state text,
  location_country text,
  industry text,
  company_size text,
  employee_count integer,
  specialities text[] DEFAULT '{}',
  hiring_signal_detected boolean NOT NULL DEFAULT false,
  hiring_signal_score integer NOT NULL DEFAULT 0,
  hiring_signal_reasons text[] DEFAULT '{}',
  contact_email text,
  contact_email_status text,
  search_industry text,
  search_location text,
  search_company_size text,
  website_domain text,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_sourcing_raw_user_linkedin_unique UNIQUE (user_id, company_linkedin_url)
);
CREATE INDEX IF NOT EXISTS idx_client_sourcing_raw_user_id ON public.client_sourcing_raw(user_id);
CREATE INDEX IF NOT EXISTS idx_client_sourcing_raw_score ON public.client_sourcing_raw(hiring_signal_score DESC);
ALTER TABLE public.client_sourcing_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_sourcing_select_own" ON public.client_sourcing_raw;
CREATE POLICY "client_sourcing_select_own" ON public.client_sourcing_raw FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "client_sourcing_insert_own" ON public.client_sourcing_raw;
CREATE POLICY "client_sourcing_insert_own" ON public.client_sourcing_raw FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "client_sourcing_update_own" ON public.client_sourcing_raw;
CREATE POLICY "client_sourcing_update_own" ON public.client_sourcing_raw FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "client_sourcing_delete_own" ON public.client_sourcing_raw;
CREATE POLICY "client_sourcing_delete_own" ON public.client_sourcing_raw FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CANDIDATE SOURCING RAW (n8n "Candidate Sourcing" branch writes here)
CREATE TABLE IF NOT EXISTS public.candidate_sourcing_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  linkedin_url text NOT NULL,
  public_identifier text,
  first_name text,
  last_name text,
  headline text,
  about text,
  location_city text,
  location_state text,
  location_country text,
  current_title text,
  current_company text,
  top_skills text[] DEFAULT '{}',
  open_to_work boolean NOT NULL DEFAULT false,
  job_seeking_score integer NOT NULL DEFAULT 0,
  job_seeking_reasons text[] DEFAULT '{}',
  email text,
  email_status text,
  search_role text,
  search_location text,
  search_experience text,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_sourcing_raw_user_linkedin_unique UNIQUE (user_id, linkedin_url)
);
CREATE INDEX IF NOT EXISTS idx_candidate_sourcing_raw_user_id ON public.candidate_sourcing_raw(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_sourcing_raw_score ON public.candidate_sourcing_raw(job_seeking_score DESC);
ALTER TABLE public.candidate_sourcing_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "candidate_sourcing_select_own" ON public.candidate_sourcing_raw;
CREATE POLICY "candidate_sourcing_select_own" ON public.candidate_sourcing_raw FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "candidate_sourcing_insert_own" ON public.candidate_sourcing_raw;
CREATE POLICY "candidate_sourcing_insert_own" ON public.candidate_sourcing_raw FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "candidate_sourcing_update_own" ON public.candidate_sourcing_raw;
CREATE POLICY "candidate_sourcing_update_own" ON public.candidate_sourcing_raw FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "candidate_sourcing_delete_own" ON public.candidate_sourcing_raw;
CREATE POLICY "candidate_sourcing_delete_own" ON public.candidate_sourcing_raw FOR DELETE TO authenticated USING (auth.uid() = user_id);

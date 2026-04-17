-- Shared trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  ame_licence_no TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ LICENCES ============
CREATE TABLE public.licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  authority TEXT,
  licence_type TEXT,
  licence_number TEXT,
  ratings TEXT,
  issue_date DATE,
  expiry_date DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.licences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own licences" ON public.licences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own licences" ON public.licences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own licences" ON public.licences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own licences" ON public.licences FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER licences_updated_at BEFORE UPDATE ON public.licences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AIRCRAFT PROFILES ============
CREATE TABLE public.aircraft_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration TEXT NOT NULL,
  normalized_registration TEXT NOT NULL,
  model TEXT,
  manufacturer TEXT,
  aircraft_type_code TEXT,
  icao24 TEXT,
  serial_number TEXT,
  operator_name TEXT,
  remarks TEXT,
  lookup_source TEXT,
  lookup_status TEXT,
  lookup_timestamp TIMESTAMPTZ,
  is_manual_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_registration)
);

CREATE INDEX idx_aircraft_profiles_user ON public.aircraft_profiles(user_id);
CREATE INDEX idx_aircraft_profiles_norm ON public.aircraft_profiles(normalized_registration);

ALTER TABLE public.aircraft_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own aircraft" ON public.aircraft_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own aircraft" ON public.aircraft_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own aircraft" ON public.aircraft_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own aircraft" ON public.aircraft_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER aircraft_profiles_updated_at BEFORE UPDATE ON public.aircraft_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AIRCRAFT LOOKUP CACHE (shared) ============
CREATE TABLE public.aircraft_lookup_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_registration TEXT NOT NULL UNIQUE,
  model TEXT,
  manufacturer TEXT,
  aircraft_type_code TEXT,
  icao24 TEXT,
  serial_number TEXT,
  operator_name TEXT,
  lookup_source TEXT,
  status TEXT NOT NULL,
  raw_response JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lookup_cache_norm ON public.aircraft_lookup_cache(normalized_registration);

ALTER TABLE public.aircraft_lookup_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cache" ON public.aircraft_lookup_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cache" ON public.aircraft_lookup_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cache" ON public.aircraft_lookup_cache FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER lookup_cache_updated_at BEFORE UPDATE ON public.aircraft_lookup_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MAINTENANCE LOGS ============
CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aircraft_profile_id UUID REFERENCES public.aircraft_profiles(id) ON DELETE SET NULL,
  registration TEXT,
  aircraft_model TEXT,
  manufacturer TEXT,
  ata_chapter TEXT,
  fault_description TEXT NOT NULL,
  symptoms TEXT[] NOT NULL DEFAULT '{}',
  root_cause TEXT,
  action_taken TEXT,
  tools_used TEXT,
  time_spent_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  voice_note_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_user_created ON public.maintenance_logs(user_id, created_at DESC);
CREATE INDEX idx_logs_aircraft ON public.maintenance_logs(aircraft_profile_id);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own logs" ON public.maintenance_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own logs" ON public.maintenance_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own logs" ON public.maintenance_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own logs" ON public.maintenance_logs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER logs_updated_at BEFORE UPDATE ON public.maintenance_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
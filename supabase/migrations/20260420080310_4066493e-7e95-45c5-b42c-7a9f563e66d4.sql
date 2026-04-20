-- Trigram extension first (used by the index below)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. New optional fields + sharing toggle on maintenance_logs
ALTER TABLE public.maintenance_logs
  ADD COLUMN IF NOT EXISTS system_component text,
  ADD COLUMN IF NOT EXISTS maintenance_reference text,
  ADD COLUMN IF NOT EXISTS share_to_community boolean NOT NULL DEFAULT true;

-- 2. User-level master switch on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_to_community_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS country_region text;

-- 3. Community fault library (anonymized)
CREATE TABLE IF NOT EXISTS public.community_fault_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_log_id uuid NOT NULL UNIQUE,
  aircraft_model text,
  manufacturer text,
  ata_chapter text,
  fault_description text NOT NULL,
  action_taken text,
  root_cause text,
  system_component text,
  maintenance_reference text,
  country_region text,
  is_anonymized boolean NOT NULL DEFAULT true,
  approved_for_global_search boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_fault_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read community" ON public.community_fault_library;
CREATE POLICY "Authenticated read community"
  ON public.community_fault_library FOR SELECT
  TO authenticated USING (approved_for_global_search = true);

CREATE INDEX IF NOT EXISTS idx_cfl_aircraft ON public.community_fault_library(aircraft_model);
CREATE INDEX IF NOT EXISTS idx_cfl_ata ON public.community_fault_library(ata_chapter);
CREATE INDEX IF NOT EXISTS idx_cfl_fault_trgm ON public.community_fault_library USING gin (fault_description gin_trgm_ops);

DROP TRIGGER IF EXISTS cfl_set_updated_at ON public.community_fault_library;
CREATE TRIGGER cfl_set_updated_at
  BEFORE UPDATE ON public.community_fault_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Sync function: keeps community_fault_library in lockstep with shared logs
CREATE OR REPLACE FUNCTION public.sync_community_fault_library()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_default boolean;
  v_country text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.community_fault_library WHERE source_log_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT share_to_community_default, country_region
    INTO v_share_default, v_country
  FROM public.profiles WHERE user_id = NEW.user_id;

  IF (NEW.share_to_community = true
      AND COALESCE(v_share_default, true) = true
      AND length(coalesce(NEW.fault_description, '')) > 0
      AND length(coalesce(NEW.action_taken, '')) > 0
      AND length(coalesce(NEW.ata_chapter, '')) > 0) THEN
    INSERT INTO public.community_fault_library (
      source_log_id, aircraft_model, manufacturer, ata_chapter,
      fault_description, action_taken, root_cause,
      system_component, maintenance_reference, country_region
    ) VALUES (
      NEW.id, NEW.aircraft_model, NEW.manufacturer, NEW.ata_chapter,
      NEW.fault_description, NEW.action_taken, NEW.root_cause,
      NEW.system_component, NEW.maintenance_reference, v_country
    )
    ON CONFLICT (source_log_id) DO UPDATE SET
      aircraft_model = EXCLUDED.aircraft_model,
      manufacturer = EXCLUDED.manufacturer,
      ata_chapter = EXCLUDED.ata_chapter,
      fault_description = EXCLUDED.fault_description,
      action_taken = EXCLUDED.action_taken,
      root_cause = EXCLUDED.root_cause,
      system_component = EXCLUDED.system_component,
      maintenance_reference = EXCLUDED.maintenance_reference,
      country_region = EXCLUDED.country_region,
      updated_at = now();
  ELSE
    DELETE FROM public.community_fault_library WHERE source_log_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_community ON public.maintenance_logs;
CREATE TRIGGER trg_sync_community
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_fault_library();
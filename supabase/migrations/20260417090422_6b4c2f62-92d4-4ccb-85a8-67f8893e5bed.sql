DROP POLICY IF EXISTS "Authenticated insert cache" ON public.aircraft_lookup_cache;
DROP POLICY IF EXISTS "Authenticated update cache" ON public.aircraft_lookup_cache;

CREATE OR REPLACE FUNCTION public.upsert_aircraft_lookup_cache(
  p_norm TEXT,
  p_model TEXT,
  p_manufacturer TEXT,
  p_type_code TEXT,
  p_icao24 TEXT,
  p_serial TEXT,
  p_operator TEXT,
  p_source TEXT,
  p_status TEXT,
  p_raw JSONB
)
RETURNS public.aircraft_lookup_cache
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.aircraft_lookup_cache;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.aircraft_lookup_cache (
    normalized_registration, model, manufacturer, aircraft_type_code,
    icao24, serial_number, operator_name, lookup_source, status, raw_response, expires_at
  ) VALUES (
    p_norm, p_model, p_manufacturer, p_type_code, p_icao24, p_serial,
    p_operator, p_source, p_status, p_raw, now() + interval '30 days'
  )
  ON CONFLICT (normalized_registration) DO UPDATE SET
    model = EXCLUDED.model,
    manufacturer = EXCLUDED.manufacturer,
    aircraft_type_code = EXCLUDED.aircraft_type_code,
    icao24 = EXCLUDED.icao24,
    serial_number = EXCLUDED.serial_number,
    operator_name = EXCLUDED.operator_name,
    lookup_source = EXCLUDED.lookup_source,
    status = EXCLUDED.status,
    raw_response = EXCLUDED.raw_response,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;
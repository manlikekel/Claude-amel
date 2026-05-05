-- Restrict organization self-join to 'member' role only (prevent privilege escalation)
DROP POLICY IF EXISTS "Users join via insert self" ON public.organization_members;
CREATE POLICY "Users join via insert self"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'member');

-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE; grant only where needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_community_fault_library() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_aircraft_lookup_cache(text,text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_aircraft_lookup_cache(text,text,text,text,text,text,text,text,text,jsonb) TO authenticated;

-- Organizations (team/MRO workspaces) — schema only for now
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Roles enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;

-- Organization policies
CREATE POLICY "Members view own orgs" ON public.organizations
  FOR SELECT USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "Authenticated create orgs" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members update org" ON public.organizations
  FOR UPDATE USING (public.is_org_member(auth.uid(), id));

-- Member policies
CREATE POLICY "Users view own memberships" ON public.organization_members
  FOR SELECT USING (auth.uid() = user_id OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users join via insert self" ON public.organization_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave own" ON public.organization_members
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-add creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_org_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();

-- Visibility on logs (personal | team | public_anon)
CREATE TYPE public.log_visibility AS ENUM ('personal', 'team', 'public_anon');

ALTER TABLE public.maintenance_logs
  ADD COLUMN visibility public.log_visibility NOT NULL DEFAULT 'personal',
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Backfill: keep existing community-shared logs visible as public_anon
UPDATE public.maintenance_logs
SET visibility = 'public_anon'
WHERE share_to_community = true;

CREATE INDEX idx_maintenance_logs_org ON public.maintenance_logs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_maintenance_logs_visibility ON public.maintenance_logs(visibility);

-- Allow team members to read team logs
CREATE POLICY "Team members view team logs" ON public.maintenance_logs
  FOR SELECT USING (
    visibility = 'team'
    AND organization_id IS NOT NULL
    AND public.is_org_member(auth.uid(), organization_id)
  );

-- Profile: target licence framework + active org
ALTER TABLE public.profiles
  ADD COLUMN target_framework TEXT,
  ADD COLUMN active_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
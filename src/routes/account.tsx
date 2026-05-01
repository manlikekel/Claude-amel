import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LogOut, Save, Loader2, Mail, Users, Plus, LogIn, Target, Copy, Check,
  KeyRound, Sun, Moon, ShieldCheck, Trash2, Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  fetchProfile, saveProfile, type ProfileData, type LicenceFramework,
  fetchLicences, saveLicence, updateLicence, deleteLicence, type LicenceEntry,
} from "@/lib/data";
import {
  fetchMyOrganizations, createOrganization, joinOrganizationBySlug,
  leaveOrganization, setActiveOrganization, type OrganizationMembership,
} from "@/lib/organizations";
import { FRAMEWORKS, type FrameworkId } from "@/lib/licence-frameworks";
import { getLicenceStatus } from "@/lib/licence-status";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "More – AMEL" },
      { name: "description", content: "Manage your AMEL profile, licences, theme and team." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileData>({
    name: "", email: "", phone: "", ame_licence_no: "", address: "",
    share_to_community_default: true, country_region: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [orgBusy, setOrgBusy] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Change password
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  // Licences
  const [licences, setLicences] = useState<LicenceEntry[]>([]);
  const [newLic, setNewLic] = useState({ authority: "", licence_type: "", licence_number: "", ratings: "", issue_date: "", expiry_date: "", remarks: "" });
  const [licBusy, setLicBusy] = useState(false);

  const refreshLicences = async () => setLicences(await fetchLicences());

  const handleChangePassword = async () => {
    if (pwdNew.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (pwdNew !== pwdConfirm) { toast.error("Passwords don't match"); return; }
    if (!user?.email) { toast.error("No account email"); return; }
    setPwdBusy(true);
    try {
      // Re-auth with current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwdCurrent });
      if (signInErr) { toast.error("Current password is incorrect"); return; }
      const { error } = await supabase.auth.updateUser({ password: pwdNew });
      if (error) throw error;
      toast.success("Password changed successfully");
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } catch (e: any) { toast.error(e?.message ?? "Couldn't change password"); }
    finally { setPwdBusy(false); }
  };

  const handleAddLicence = async () => {
    if (!newLic.authority || !newLic.licence_type) { toast.error("Add authority and licence type"); return; }
    setLicBusy(true);
    try {
      await saveLicence(newLic);
      setNewLic({ authority: "", licence_type: "", licence_number: "", ratings: "", issue_date: "", expiry_date: "", remarks: "" });
      await refreshLicences();
      toast.success("Licence added");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setLicBusy(false); }
  };

  const handleDeleteLicence = async (id: string) => {
    if (!confirm("Delete this licence?")) return;
    try { await deleteLicence(id); await refreshLicences(); toast.success("Deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const handleUpdateLicenceExpiry = async (lic: LicenceEntry, newDate: string) => {
    try { await updateLicence(lic.id, { ...lic, expiry_date: newDate }); await refreshLicences(); toast.success("Updated"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const refreshOrgs = async () => setMemberships(await fetchMyOrganizations());

  useEffect(() => {
    Promise.all([fetchProfile(), fetchMyOrganizations(), fetchLicences()]).then(([p, m, l]) => {
      setProfile(p);
      setMemberships(m);
      setLicences(l);
      setLoading(false);
    });
  }, []);

  const setFramework = async (id: FrameworkId) => {
    const next = { ...profile, target_framework: id as LicenceFramework };
    setProfile(next);
    try { await saveProfile(next); toast.success(`Target set to ${FRAMEWORKS[id].name}`); }
    catch (e: any) { toast.error(e?.message ?? "Couldn't save"); }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setOrgBusy(true);
    try {
      const org = await createOrganization(newOrgName);
      setNewOrgName("");
      await refreshOrgs();
      await setActiveOrganization(org.id);
      setProfile((p) => ({ ...p, active_organization_id: org.id }));
      toast.success(`Team "${org.name}" created`);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setOrgBusy(false); }
  };

  const handleJoinOrg = async () => {
    if (!joinSlug.trim()) return;
    setOrgBusy(true);
    try {
      await joinOrganizationBySlug(joinSlug);
      setJoinSlug("");
      await refreshOrgs();
      toast.success("Joined team");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setOrgBusy(false); }
  };

  const handleLeave = async (orgId: string) => {
    if (!confirm("Leave this team?")) return;
    try {
      await leaveOrganization(orgId);
      if (profile.active_organization_id === orgId) {
        await setActiveOrganization(null);
        setProfile({ ...profile, active_organization_id: null });
      }
      await refreshOrgs();
      toast.success("Left team");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const handleSetActive = async (orgId: string | null) => {
    try {
      await setActiveOrganization(orgId);
      setProfile({ ...profile, active_organization_id: orgId });
      toast.success(orgId ? "Active team updated" : "Cleared active team");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const copySlug = async (slug: string) => {
    try { await navigator.clipboard.writeText(slug); setCopiedSlug(slug); setTimeout(() => setCopiedSlug(null), 1500); } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const up = (s: string | null | undefined) => (s ?? "").toUpperCase();
      await saveProfile({
        ...profile,
        name: up(profile.name),
        ame_licence_no: up(profile.ame_licence_no),
        address: up(profile.address),
        country_region: up(profile.country_region),
        phone: up(profile.phone),
      });
      toast.success("Profile saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  return (
    <div className="min-h-screen bg-background pb-32 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-primary/6 blur-[80px]" />

      <div className="mx-auto max-w-lg px-5 pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-primary drop-shadow-[0_0_12px_oklch(0.78_0.12_80/0.3)]">Account</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Mail className="h-3.5 w-3.5" />
            {user?.email}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card className="p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
                Engineer Profile
              </h2>
              <div className="flex flex-col gap-3">
                <Field label="Full Name">
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="John Doe"
                    className="uppercase placeholder:normal-case"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+234 ..."
                    className="uppercase placeholder:normal-case"
                  />
                </Field>
                <Field label="AME Licence No.">
                  <Input
                    value={profile.ame_licence_no}
                    onChange={(e) => setProfile({ ...profile, ame_licence_no: e.target.value })}
                    placeholder="e.g. NCAA/AME/0123"
                    className="uppercase placeholder:normal-case"
                  />
                </Field>
                <Field label="Address">
                  <Input
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Hangar / Base address"
                    className="uppercase placeholder:normal-case"
                  />
                </Field>
                <Field label="Country / Region (optional)">
                  <Input
                    value={profile.country_region ?? ""}
                    onChange={(e) => setProfile({ ...profile, country_region: e.target.value })}
                    placeholder="e.g. Nigeria, West Africa"
                    className="uppercase placeholder:normal-case"
                  />
                </Field>

                <Button variant="hero" size="lg" onClick={handleSave} disabled={saving} className="mt-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Profile
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Global Knowledge Sharing
              </h2>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Share new logs anonymously by default</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    When OFF, none of your future logs will be added to the global troubleshooting database, regardless of per-log toggles.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.share_to_community_default ?? true}
                  onClick={() => setProfile({ ...profile, share_to_community_default: !(profile.share_to_community_default ?? true) })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    (profile.share_to_community_default ?? true) ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      (profile.share_to_community_default ?? true) ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Licence Target Framework */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Licence Target</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Pick the regulator you're preparing for. Drives your readiness score.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FRAMEWORKS) as FrameworkId[]).map((id) => {
                  const active = (profile.target_framework ?? "NCAA") === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setFramework(id)}
                      className={`rounded-xl px-2 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                        active ? "gold-gradient text-primary-foreground gold-glow-sm" : "glass-subtle text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {FRAMEWORKS[id].name}
                    </button>
                  );
                })}
              </div>
              <Link to="/readiness" className="mt-3 block text-xs text-primary underline-offset-2 hover:underline">
                View readiness →
              </Link>
            </Card>

            {/* Teams */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Teams</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Optional. Share logs with hangar mates by switching a log's visibility to "Team".
              </p>

              {memberships.length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {memberships.map((m) => {
                    const isActive = profile.active_organization_id === m.organization_id;
                    const slug = m.organizations?.slug ?? "";
                    return (
                      <div key={m.id} className="rounded-xl glass-subtle p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {m.organizations?.name ?? "Team"}
                            </p>
                            <button
                              onClick={() => copySlug(slug)}
                              className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
                            >
                              ID: {slug}
                              {copiedSlug === slug ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.role}</span>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant={isActive ? "secondary" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSetActive(isActive ? null : m.organization_id)}
                          >
                            {isActive ? "Active" : "Set active"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleLeave(m.organization_id)}>
                            Leave
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Create a team</label>
                <div className="flex gap-2">
                  <Input
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g. Lagos Hangar 3"
                    className="placeholder:normal-case"
                  />
                  <Button variant="action" size="default" onClick={handleCreateOrg} disabled={orgBusy || !newOrgName.trim()}>
                    {orgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>

                <label className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Join with team ID</label>
                <div className="flex gap-2">
                  <Input
                    value={joinSlug}
                    onChange={(e) => setJoinSlug(e.target.value)}
                    placeholder="e.g. lagos-hangar-3"
                    className="placeholder:normal-case"
                  />
                  <Button variant="action" size="default" onClick={handleJoinOrg} disabled={orgBusy || !joinSlug.trim()}>
                    {orgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Session
              </h2>
              <Button variant="outline" size="lg" onClick={handleSignOut} className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

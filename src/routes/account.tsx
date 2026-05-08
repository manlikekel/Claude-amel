import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LogOut, Save, Loader2, Mail, Users, Plus, LogIn, Target, Copy, Check,
  KeyRound, Sun, Moon, ShieldCheck, Trash2, Plane, Cog, ShieldAlert,
  Wrench, GraduationCap, Briefcase, Globe, BadgeCheck, Download, AlertTriangle,
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
import { LOCALES, getLocale, setLocale, type Locale } from "@/lib/i18n";
import { downloadUserDataJson, deleteAllUserData } from "@/lib/data-export";
import { recordAudit } from "@/lib/audit";

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
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="label-overline">Settings</p>
          <h1 className="page-title mt-1">Acc<span className="gold-text">ount</span></h1>
          <p className="page-subtitle flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            <span className="font-mono text-[11px]">{user?.email}</span>
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-3xl">
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
                  data-on={(profile.share_to_community_default ?? true) ? "true" : "false"}
                  onClick={() => setProfile({ ...profile, share_to_community_default: !(profile.share_to_community_default ?? true) })}
                  className="amel-switch"
                />
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
              <div className="flex gap-1.5">
                {(Object.keys(FRAMEWORKS) as FrameworkId[]).map((id) => {
                  const active = (profile.target_framework ?? "NCAA") === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setFramework(id)}
                      data-active={active}
                      className="seg-pill flex-1 press"
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

            {/* Appearance / Theme */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Appearance</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Dark is hangar-friendly. Light is for bright environments.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme("dark")}
                  className={`rounded-xl px-3 py-3 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    theme === "dark" ? "gold-gradient text-primary-foreground gold-glow-sm" : "glass-subtle text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-4 w-4" /> Dark
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`rounded-xl px-3 py-3 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    theme === "light" ? "gold-gradient text-primary-foreground gold-glow-sm" : "glass-subtle text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-4 w-4" /> Light
                </button>
              </div>
            </Card>

            {/* Licences */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Plane className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Licences</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Track issuing authority, ratings and expiry. We'll remind you as they approach renewal.
              </p>

              {licences.length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {licences.map((lic) => {
                    const status = getLicenceStatus(lic.expiry_date);
                    return (
                      <div key={lic.id} className="rounded-xl glass-subtle p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {lic.authority} · {lic.licence_type}
                            </p>
                            {lic.licence_number && (
                              <p className="text-[11px] text-muted-foreground truncate">No. {lic.licence_number}</p>
                            )}
                            {lic.ratings && (
                              <p className="text-[11px] text-muted-foreground truncate">Ratings: {lic.ratings}</p>
                            )}
                            <p className={`mt-1 text-[11px] font-semibold ${status.colorClass}`}>{status.label}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteLicence(lic.id)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            aria-label="Delete licence"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expiry</label>
                          <Input
                            type="date"
                            value={lic.expiry_date ?? ""}
                            onChange={(e) => handleUpdateLicenceExpiry(lic, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-xl glass-subtle p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Add a licence</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={newLic.authority}
                    onChange={(e) => setNewLic({ ...newLic, authority: e.target.value })}
                    placeholder="Authority (e.g. NCAA)"
                    className="placeholder:normal-case"
                  />
                  <Input
                    value={newLic.licence_type}
                    onChange={(e) => setNewLic({ ...newLic, licence_type: e.target.value })}
                    placeholder="Type (e.g. AME)"
                    className="placeholder:normal-case"
                  />
                </div>
                <Input
                  value={newLic.licence_number}
                  onChange={(e) => setNewLic({ ...newLic, licence_number: e.target.value })}
                  placeholder="Licence No. (optional)"
                  className="placeholder:normal-case"
                />
                <Input
                  value={newLic.ratings}
                  onChange={(e) => setNewLic({ ...newLic, ratings: e.target.value })}
                  placeholder="Ratings (e.g. B737, A320)"
                  className="placeholder:normal-case"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Issue date</label>
                    <Input type="date" value={newLic.issue_date} onChange={(e) => setNewLic({ ...newLic, issue_date: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expiry date</label>
                    <Input type="date" value={newLic.expiry_date} onChange={(e) => setNewLic({ ...newLic, expiry_date: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <Button variant="action" size="default" onClick={handleAddLicence} disabled={licBusy}>
                  {licBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add licence
                </Button>
              </div>
            </Card>

            {/* Change Password */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Change Password</h2>
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Current password">
                  <Input type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </Field>
                <Field label="New password">
                  <Input type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                </Field>
                <Field label="Confirm new password">
                  <Input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
                </Field>
                <Button variant="hero" size="lg" onClick={handleChangePassword} disabled={pwdBusy || !pwdCurrent || !pwdNew || !pwdConfirm}>
                  {pwdBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Update password
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <Cog className="h-3.5 w-3.5" /> Maintenance Toolkit
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/components"><Button variant="action" size="lg" className="w-full justify-start gap-2"><Cog className="h-4 w-4 text-primary" />Components</Button></Link>
                <Link to="/ad-sb"><Button variant="action" size="lg" className="w-full justify-start gap-2"><ShieldAlert className="h-4 w-4 text-primary" />AD / SB</Button></Link>
                <Link to="/tools"><Button variant="action" size="lg" className="w-full justify-start gap-2"><Wrench className="h-4 w-4 text-primary" />Tool Cal.</Button></Link>
                <Link to="/cpd"><Button variant="action" size="lg" className="w-full justify-start gap-2"><GraduationCap className="h-4 w-4 text-primary" />CPD</Button></Link>
                <Link to="/type-ratings"><Button variant="action" size="lg" className="w-full justify-start gap-2"><Plane className="h-4 w-4 text-primary" />Type ratings</Button></Link>
                <Link to="/jobs"><Button variant="action" size="lg" className="w-full justify-start gap-2"><Briefcase className="h-4 w-4 text-primary" />Jobs</Button></Link>
              </div>
            </Card>

            <VerificationCard />

            <LocaleCard />

            <PrivacyCard />

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

function VerificationCard() {
  const [status, setStatus] = useState<string>("unverified");
  const [authority, setAuthority] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("ame_verification_status, ame_verification_authority, ame_verification_evidence_url").maybeSingle();
      if (data) {
        setStatus((data as any).ame_verification_status ?? "unverified");
        setAuthority((data as any).ame_verification_authority ?? "");
        setEvidenceUrl((data as any).ame_verification_evidence_url ?? "");
      }
    })();
  }, []);

  const submit = async () => {
    if (!authority || !evidenceUrl) { toast.error("Authority and evidence URL required"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await supabase.from("profiles").update({
        ame_verification_status: "pending",
        ame_verification_authority: authority,
        ame_verification_evidence_url: evidenceUrl,
      }).eq("user_id", user.id);
      await recordAudit("profile.verification_requested", { resource_type: "profile", resource_id: user.id });
      setStatus("pending");
      toast.success("Verification submitted — review usually takes 2–3 business days");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <Card className="p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
        <BadgeCheck className="h-3.5 w-3.5" /> AME Verification
      </h2>

      {status === "verified" ? (
        <div className="flex items-center gap-2">
          <span className="badge-success"><BadgeCheck className="h-3 w-3" />Verified AME</span>
          <p className="text-xs text-muted-foreground">{authority}</p>
        </div>
      ) : status === "pending" ? (
        <p className="text-sm text-muted-foreground">
          Verification pending. We'll email you when review is complete.
        </p>
      ) : status === "rejected" ? (
        <p className="text-sm text-destructive">Last submission was rejected. You can re-submit with corrected evidence.</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-sm text-muted-foreground">
            Verified AMEs get a badge on community contributions and can co-sign log entries.
          </p>
          <Field label="Issuing authority">
            <select
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[oklch(1_0_0/0.03)] px-3 text-sm text-foreground"
            >
              <option value="">Select…</option>
              {Object.values(FRAMEWORKS).map((f) => <option key={f.id} value={f.id}>{f.fullName}</option>)}
            </select>
          </Field>
          <Field label="Licence document URL or scan">
            <Input placeholder="https://… or upload scan to your cloud and paste link" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
          </Field>
          <Button variant="hero" onClick={submit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for verification"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function LocaleCard() {
  const [current, setCurrent] = useState<Locale>(getLocale());

  const change = async (loc: Locale) => {
    setLocale(loc);
    setCurrent(loc);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ locale: loc }).eq("user_id", user.id);
    } catch { /* non-fatal */ }
    toast.success("Language updated");
  };

  return (
    <Card className="p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> Language
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {LOCALES.map((l) => (
          <button
            key={l.id}
            onClick={() => change(l.id)}
            data-active={current === l.id}
            className="seg-pill press text-left"
          >
            <span className="flex flex-col items-start gap-0">
              <span className="text-[11px]">{l.native}</span>
              <span className="text-[9px] opacity-70 normal-case">{l.name}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Aviation terminology requires native-speaking AME translators for full accuracy. Help improve translations via support@amel.app.
      </p>
    </Card>
  );
}

function PrivacyCard() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      await downloadUserDataJson();
      toast.success("Data exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally { setExporting(false); }
  };

  const wipeData = async () => {
    const confirmed = window.prompt('Type "DELETE" to wipe all your data. This cannot be undone.');
    if (confirmed !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAllUserData();
      toast.success("Data wiped");
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    } finally { setDeleting(false); }
  };

  return (
    <Card className="p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" /> Data Privacy (GDPR / CCPA)
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        Export every record we hold for you, or wipe it all permanently.
      </p>
      <div className="flex flex-col gap-2">
        <Button variant="action" onClick={exportData} disabled={exporting} className="w-full justify-start">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2 text-primary" />}
          Export my data (JSON)
        </Button>
        <Button variant="outline" onClick={wipeData} disabled={deleting} className="w-full justify-start text-destructive border-destructive/40 hover:bg-destructive/10">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
          Delete all my data
        </Button>
      </div>
    </Card>
  );
}

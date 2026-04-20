import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Save, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { fetchProfile, saveProfile, type ProfileData } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account – AMEL" },
      { name: "description", content: "Manage your AMEL account and profile." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    name: "", email: "", phone: "", ame_licence_no: "", address: "",
    share_to_community_default: true, country_region: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile(profile);
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
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+234 ..."
                  />
                </Field>
                <Field label="AME Licence No.">
                  <Input
                    value={profile.ame_licence_no}
                    onChange={(e) => setProfile({ ...profile, ame_licence_no: e.target.value })}
                    placeholder="e.g. NCAA/AME/0123"
                  />
                </Field>
                <Field label="Address">
                  <Input
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Hangar / Base address"
                  />
                </Field>
                <Field label="Country / Region (optional)">
                  <Input
                    value={profile.country_region ?? ""}
                    onChange={(e) => setProfile({ ...profile, country_region: e.target.value })}
                    placeholder="e.g. Nigeria, West Africa"
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

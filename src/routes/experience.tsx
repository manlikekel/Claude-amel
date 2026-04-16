import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Plane, Wrench, BookOpen, Plus, Trash2, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getExperienceData, getStats, getLicences, saveLicence, deleteLicence,
  getProfile, saveProfile, type LicenceEntry, type ProfileData
} from "@/lib/store";
import { generateLogbookPDF } from "@/lib/pdf-export";
import { motion } from "framer-motion";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "My Experience – AMEL" },
      { name: "description", content: "Track your aircraft maintenance experience." },
    ],
  }),
  component: ExperiencePage,
});

function ExperiencePage() {
  const [data, setData] = useState<ReturnType<typeof getExperienceData> | null>(null);
  const [stats, setStats] = useState({ totalLogs: 0, aircraftTypes: 0, totalHours: 0, ataChapters: 0 });
  const [licences, setLicences] = useState<LicenceEntry[]>([]);
  const [profile, setProfile] = useState<ProfileData>({ name: "", email: "", phone: "", ame_licence_no: "", address: "" });
  const [showLicenceForm, setShowLicenceForm] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [licForm, setLicForm] = useState({ authority: "", licence_type: "", licence_number: "", ratings: "", issue_date: "", expiry_date: "", remarks: "" });

  useEffect(() => {
    setData(getExperienceData());
    setStats(getStats());
    setLicences(getLicences());
    setProfile(getProfile());
  }, []);

  const handleSaveLicence = () => {
    if (!licForm.authority || !licForm.licence_number) return;
    saveLicence(licForm);
    setLicences(getLicences());
    setLicForm({ authority: "", licence_type: "", licence_number: "", ratings: "", issue_date: "", expiry_date: "", remarks: "" });
    setShowLicenceForm(false);
  };

  const handleDeleteLicence = (id: string) => {
    deleteLicence(id);
    setLicences(getLicences());
  };

  const handleSaveProfile = () => {
    saveProfile(profile);
    setShowProfileForm(false);
  };

  const aircraftEntries = data ? Object.entries(data.byAircraft) : [];
  const ataEntries = data ? Object.entries(data.byAta).sort((a, b) => b[1] - a[1]).slice(0, 12) : [];
  const maxAta = ataEntries.length > 0 ? Math.max(...ataEntries.map(([, v]) => v)) : 1;

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 left-1/3 h-48 w-48 rounded-full bg-primary/6 blur-[80px]" />

      <div className="mx-auto max-w-lg px-5 pt-6 relative">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">My Experience</h1>
        </div>

        {/* Summary */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 grid grid-cols-3 gap-3">
          <StatBox icon={Wrench} value={stats.totalLogs} label="Total Jobs" />
          <StatBox icon={Plane} value={stats.aircraftTypes} label="Aircraft" />
          <StatBox icon={BookOpen} value={stats.ataChapters} label="ATA Chapters" />
        </motion.div>

        {/* Profile Section */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Profile</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowProfileForm(!showProfileForm)}>
              <User className="h-3.5 w-3.5 mr-1" />
              {showProfileForm ? "Close" : "Edit"}
            </Button>
          </div>
          {showProfileForm ? (
            <Card className="p-4 flex flex-col gap-3">
              <Input placeholder="Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <Input placeholder="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              <Input placeholder="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              <Input placeholder="AME Licence No." value={profile.ame_licence_no} onChange={(e) => setProfile({ ...profile, ame_licence_no: e.target.value })} />
              <Input placeholder="Address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
              <Button variant="default" size="sm" onClick={handleSaveProfile}>Save Profile</Button>
            </Card>
          ) : profile.name ? (
            <Card className="p-3">
              <p className="text-sm font-medium text-foreground">{profile.name}</p>
              {profile.ame_licence_no && <p className="text-xs text-muted-foreground">AME: {profile.ame_licence_no}</p>}
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">No profile set. Tap Edit to add your details for the PDF export.</p>
          )}
        </motion.section>

        {/* Licences Section */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Licences & Ratings</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowLicenceForm(!showLicenceForm)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          {showLicenceForm && (
            <Card className="mb-3 p-4 flex flex-col gap-3">
              <Input placeholder="Authority (e.g. NCAA, EASA)" value={licForm.authority} onChange={(e) => setLicForm({ ...licForm, authority: e.target.value })} />
              <Input placeholder="Type (e.g. B1.1)" value={licForm.licence_type} onChange={(e) => setLicForm({ ...licForm, licence_type: e.target.value })} />
              <Input placeholder="Licence Number" value={licForm.licence_number} onChange={(e) => setLicForm({ ...licForm, licence_number: e.target.value })} />
              <Input placeholder="Ratings (e.g. CRJ200, EMB170)" value={licForm.ratings} onChange={(e) => setLicForm({ ...licForm, ratings: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" placeholder="Issue Date" value={licForm.issue_date} onChange={(e) => setLicForm({ ...licForm, issue_date: e.target.value })} />
                <Input type="date" placeholder="Expiry Date" value={licForm.expiry_date} onChange={(e) => setLicForm({ ...licForm, expiry_date: e.target.value })} />
              </div>
              <Input placeholder="Remarks" value={licForm.remarks} onChange={(e) => setLicForm({ ...licForm, remarks: e.target.value })} />
              <Button variant="default" size="sm" onClick={handleSaveLicence}>Save Licence</Button>
            </Card>
          )}

          {licences.length === 0 && !showLicenceForm ? (
            <p className="text-sm text-muted-foreground">No licences added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {licences.map((lic) => (
                <Card key={lic.id} className="p-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{lic.authority} – {lic.licence_type}</p>
                    <p className="text-xs text-muted-foreground">{lic.licence_number} · Exp: {lic.expiry_date || "N/A"}</p>
                    {lic.ratings && <p className="text-xs text-primary mt-0.5">{lic.ratings}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteLicence(lic.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </motion.section>

        {/* Aircraft Hours */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Aircraft Hours</h2>
          {aircraftEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aircraftEntries.map(([type, info]) => {
                const maxHours = Math.max(...aircraftEntries.map(([, i]) => i.hours), 1);
                const pct = (info.hours / maxHours) * 100;
                return (
                  <Card key={type} className="p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{type}</span>
                      <span className="text-xs text-muted-foreground">
                        {info.hours}h · {info.jobs} jobs
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/50">
                      <motion.div
                        className="h-2 rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ATA Coverage */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">ATA Coverage</h2>
          {ataEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {ataEntries.map(([ata, count]) => (
                <div key={ata} className="flex items-center gap-3">
                  <span className="w-8 text-right text-xs font-mono text-muted-foreground">{ata}</span>
                  <div className="flex-1">
                    <div className="h-1.5 w-full rounded-full bg-muted/50">
                      <motion.div
                        className="h-1.5 rounded-full bg-primary/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxAta) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <span className="w-6 text-xs text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Generate PDF */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Button variant="hero" size="xl" className="w-full gap-2" onClick={generateLogbookPDF}>
            <FileText className="h-5 w-5" />
            Export Logbook PDF
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <Card className="flex flex-col items-center p-4">
      <Icon className="mb-1.5 h-5 w-5 text-primary" />
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </Card>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Briefcase, Plus, ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchJobs, postJob, type JobPosting, type JobType } from "@/lib/jobs";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Aviation Jobs – AMEL" },
      { name: "description", content: "Maintenance opportunities posted by operators and MROs." },
    ],
  }),
  component: JobsPage,
});

const EMPTY = {
  organization_id: null as string | null,
  title: "",
  company: "",
  location: "",
  country: "",
  job_type: "full_time" as JobType,
  required_authority: "",
  required_categories: [] as string[],
  required_aircraft: [] as string[],
  description: "",
  salary_min: null as number | null,
  salary_max: null as number | null,
  salary_currency: "USD",
  contact_email: "",
  contact_url: "",
};

function JobsPage() {
  const [items, setItems] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterType, setFilterType] = useState<JobType | "">("");

  useEffect(() => { fetchJobs().then((d) => { setItems(d); setLoading(false); }); }, []);

  const filtered = useMemo(() => {
    return items.filter((j) => {
      if (filterCountry && j.country.toLowerCase() !== filterCountry.toLowerCase()) return false;
      if (filterType && j.job_type !== filterType) return false;
      return true;
    });
  }, [items, filterCountry, filterType]);

  const submit = async () => {
    if (!form.title || !form.company || !form.description) { toast.error("Title, company, and description required"); return; }
    setSaving(true);
    try {
      const created = await postJob(form);
      setItems((p) => [created, ...p]);
      setForm(EMPTY); setShowForm(false);
      toast.success("Job posted");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="mx-auto max-w-lg px-5 pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/account"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <p className="label-overline">Career</p>
            <h1 className="page-title mt-0.5 text-2xl">Aviation <span className="gold-text">Jobs</span></h1>
            <p className="page-subtitle">Maintenance roles & contract work</p>
          </div>
          <Button variant="action" size="icon" onClick={() => setShowForm((s) => !s)} aria-label="Post a job">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Input placeholder="Country" value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as JobType | "")}
            className="h-10 appearance-none rounded-xl border border-[var(--glass-border)] bg-[oklch(1_0_0/0.03)] px-3 text-xs text-foreground backdrop-blur-sm"
          >
            <option value="">All types</option>
            <option value="full_time">Full-time</option>
            <option value="contract">Contract</option>
            <option value="line_check">Line check</option>
            <option value="base_check">Base check</option>
          </select>
        </div>

        {showForm && (
          <Card className="p-4 mb-5">
            <Input placeholder="Job title" className="mb-2" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <Input placeholder="Company" className="mb-2" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input placeholder="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              <Input placeholder="Country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
            </div>
            <select
              value={form.job_type}
              onChange={(e) => setForm((p) => ({ ...p, job_type: e.target.value as JobType }))}
              className="h-10 w-full appearance-none rounded-xl border border-[var(--glass-border)] bg-[oklch(1_0_0/0.03)] px-3 text-xs text-foreground backdrop-blur-sm mb-2"
            >
              <option value="full_time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="line_check">Line check</option>
              <option value="base_check">Base check</option>
            </select>
            <Input placeholder="Required authority (e.g., EASA, FAA)" className="mb-2" value={form.required_authority} onChange={(e) => setForm((p) => ({ ...p, required_authority: e.target.value }))} />
            <Input placeholder="Required aircraft (comma-separated)" className="mb-2"
              value={form.required_aircraft.join(", ")}
              onChange={(e) => setForm((p) => ({ ...p, required_aircraft: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="amel-textarea mb-2 min-h-[80px]"
            />
            <Input placeholder="Contact email or URL" className="mb-3" value={form.contact_email} onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))} />
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Job"}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No jobs posted yet.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((j) => (
              <motion.div key={j.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{j.title}</p>
                      <p className="text-xs text-primary">{j.company}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {j.location} {j.country && `· ${j.country}`}
                      </p>
                    </div>
                    <span className="reg-chip text-[10px] capitalize">{j.job_type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-foreground line-clamp-3 mb-2">{j.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {j.required_authority && <span className="ata-chip">{j.required_authority}</span>}
                      {j.required_aircraft?.slice(0, 3).map((a) => <span key={a} className="ata-chip">{a}</span>)}
                    </div>
                    {j.contact_email && (
                      <a href={`mailto:${j.contact_email}`} className="text-primary hover:underline text-[11px] flex items-center gap-1">
                        Apply <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Posted {formatDistanceToNow(new Date(j.posted_at), { addSuffix: true })}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

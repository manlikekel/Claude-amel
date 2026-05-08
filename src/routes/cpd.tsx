import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, GraduationCap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { fetchCPD, saveCPD, deleteCPD, totalHoursLast24Months, CPD_CATEGORIES, type CPDRecord } from "@/lib/cpd";
import { recordAudit } from "@/lib/audit";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/cpd")({
  head: () => ({
    meta: [
      { title: "Continuing Professional Development – AMEL" },
      { name: "description", content: "Track recurrent training hours required by EASA/CAA frameworks." },
    ],
  }),
  component: CPDPage,
});

const EMPTY = {
  course_title: "",
  provider: "",
  category: "regulatory",
  start_date: null as string | null,
  end_date: null as string | null,
  hours: 0,
  certificate_url: "",
  certificate_no: "",
  framework: "",
  notes: "",
};

// EASA Part-66 Appendix IV requirement: 6 hours every 24 months. Use this as the headline target
// for the progress meter; other authorities have similar but unofficial expectations.
const TARGET_HOURS_24MO = 6;

function CPDPage() {
  const [items, setItems] = useState<CPDRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCPD().then((d) => { setItems(d); setLoading(false); }); }, []);

  const submit = async () => {
    if (!form.course_title) { toast.error("Course title required"); return; }
    setSaving(true);
    try {
      const created = await saveCPD(form);
      await recordAudit("cpd.create", { resource_type: "cpd", resource_id: created.id });
      setItems((p) => [created, ...p]);
      setForm(EMPTY); setShowForm(false);
      toast.success("CPD record added");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    await deleteCPD(id);
    setItems((p) => p.filter((c) => c.id !== id));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const last24 = totalHoursLast24Months(items);
  const pct = Math.min(100, (last24 / TARGET_HOURS_24MO) * 100);

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/account"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <p className="label-overline">Recurrent Training</p>
            <h1 className="page-title mt-0.5 text-2xl">Continuing <span className="gold-text">Development</span></h1>
            <p className="page-subtitle">Track recurrent training hours</p>
          </div>
          <Button variant="action" size="icon" onClick={() => setShowForm((s) => !s)} aria-label="Add CPD record">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Card className="hero-card p-5 mb-5">
          <p className="label-overline mb-2">Last 24 months (EASA Part-66 target {TARGET_HOURS_24MO}h)</p>
          <div className="flex items-baseline gap-2">
            <span className="metric gold-text text-4xl">{last24}</span>
            <span className="text-sm text-muted-foreground">hours</span>
          </div>
          <Progress value={pct} className="h-2 mt-3" />
        </Card>

        {showForm && (
          <Card className="p-4 mb-5">
            <Input placeholder="Course title" className="mb-2" value={form.course_title} onChange={(e) => setForm((p) => ({ ...p, course_title: e.target.value }))} />
            <Input placeholder="Provider" className="mb-2" value={form.provider} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))} />
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="h-10 w-full appearance-none rounded-xl border border-[var(--glass-border)] bg-[oklch(1_0_0/0.03)] px-3 text-xs text-foreground backdrop-blur-sm mb-2"
            >
              {CPD_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value || null }))} />
              <Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value || null }))} />
            </div>
            <Input type="number" step="0.5" placeholder="Hours" className="mb-2" value={form.hours || ""} onChange={(e) => setForm((p) => ({ ...p, hours: Number(e.target.value) || 0 }))} />
            <Input placeholder="Certificate # (optional)" className="mb-3" value={form.certificate_no} onChange={(e) => setForm((p) => ({ ...p, certificate_no: e.target.value }))} />
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {items.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No CPD records yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{c.course_title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.provider || "—"} · <span className="capitalize">{(c.category || "").replace(/_/g, " ")}</span>
                      </p>
                      <p className="text-[11px] font-mono text-primary mt-1">{c.hours}h</p>
                    </div>
                    <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

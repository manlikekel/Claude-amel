import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchADSB, saveADSB, updateADSB, deleteADSB, type ADSBItem, type ADSBType } from "@/lib/ad-sb";
import { recordAudit } from "@/lib/audit";
import { differenceInDays } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/ad-sb")({
  head: () => ({
    meta: [
      { title: "AD / SB Compliance – AMEL" },
      { name: "description", content: "Track Airworthiness Directives and Service Bulletins compliance." },
    ],
  }),
  component: ADSBPage,
});

const EMPTY = {
  aircraft_profile_id: null as string | null,
  reference_type: "AD" as ADSBType,
  reference_number: "",
  issuing_authority: "FAA",
  title: "",
  effective_date: null as string | null,
  compliance_date: null as string | null,
  next_due_date: null as string | null,
  recurring_interval_hours: null as number | null,
  recurring_interval_cycles: null as number | null,
  status: "open" as const,
  notes: "",
};

function statusBadge(item: ADSBItem) {
  if (item.status === "complied") return <span className="badge-success"><CheckCircle2 className="h-3 w-3" />Complied</span>;
  if (item.status === "not_applicable") return <span className="badge-warning">N/A</span>;
  if (item.status === "superseded") return <span className="badge-warning">Superseded</span>;
  if (item.next_due_date) {
    try {
      const days = differenceInDays(new Date(item.next_due_date), new Date());
      if (days < 0) return <span className="badge-danger"><AlertTriangle className="h-3 w-3" />Overdue</span>;
      if (days <= 30) return <span className="badge-warning"><AlertTriangle className="h-3 w-3" />Due {days}d</span>;
    } catch { /* ignore */ }
  }
  return <span className="badge-warning">Open</span>;
}

function ADSBPage() {
  const [items, setItems] = useState<ADSBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchADSB().then((d) => { setItems(d); setLoading(false); }); }, []);

  const submit = async () => {
    if (!form.reference_number || !form.title) { toast.error("Reference and title required"); return; }
    setSaving(true);
    try {
      const created = await saveADSB(form);
      await recordAudit("adsb.create", { resource_type: "ad_sb", resource_id: created.id });
      setItems((p) => [created, ...p]);
      setForm(EMPTY); setShowForm(false);
      toast.success(`${form.reference_type} added`);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const markComplied = async (id: string) => {
    try {
      await updateADSB(id, { status: "complied", compliance_date: new Date().toISOString().slice(0, 10) });
      await recordAudit("adsb.complied", { resource_type: "ad_sb", resource_id: id });
      setItems((prev) => prev.map((x) => x.id === id ? { ...x, status: "complied", compliance_date: new Date().toISOString().slice(0, 10) } : x));
      toast.success("Marked complied");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await deleteADSB(id);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/account"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <p className="label-overline">Airworthiness</p>
            <h1 className="page-title mt-0.5 text-2xl">AD / SB <span className="gold-text">Compliance</span></h1>
            <p className="page-subtitle">Track directives and bulletins per aircraft</p>
          </div>
          <Button variant="action" size="icon" onClick={() => setShowForm((s) => !s)} aria-label="Add directive">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showForm && (
          <Card className="p-4 mb-5">
            <div className="grid grid-cols-3 gap-2 mb-2">
              {(["AD", "SB", "STC"] as ADSBType[]).map((t) => (
                <button key={t} onClick={() => setForm((p) => ({ ...p, reference_type: t }))} data-active={form.reference_type === t} className="seg-pill press">{t}</button>
              ))}
            </div>
            <Input placeholder="Reference number (e.g., 2023-04-08)" className="mb-2" value={form.reference_number} onChange={(e) => setForm((p) => ({ ...p, reference_number: e.target.value }))} />
            <Input placeholder="Issuing authority" className="mb-2" value={form.issuing_authority} onChange={(e) => setForm((p) => ({ ...p, issuing_authority: e.target.value }))} />
            <Input placeholder="Title / subject" className="mb-2" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="label-overline mb-1">Effective</p>
                <Input type="date" value={form.effective_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value || null }))} />
              </div>
              <div>
                <p className="label-overline mb-1">Next due</p>
                <Input type="date" value={form.next_due_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, next_due_date: e.target.value || null }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {items.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <ShieldAlert className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No directives tracked yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <motion.div key={it.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="reg-chip">{it.reference_type}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">{it.reference_number}</span>
                        {statusBadge(it)}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{it.title}</p>
                      {it.next_due_date && <p className="text-[11px] text-muted-foreground mt-1">Next due {it.next_due_date}</p>}
                    </div>
                  </div>
                  {it.status !== "complied" && (
                    <div className="flex gap-2 mt-2">
                      <Button variant="action" size="sm" onClick={() => markComplied(it.id)}>Mark complied</Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(it.id)}>Remove</Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

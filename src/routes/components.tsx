import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Cog, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { fetchComponents, saveComponent, deleteComponent, timeRemaining, type Component } from "@/lib/components";
import { recordAudit } from "@/lib/audit";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/components")({
  head: () => ({
    meta: [
      { title: "Components – AMEL" },
      { name: "description", content: "Track aircraft components with TSN, TSO, and cycle counts." },
    ],
  }),
  component: ComponentsPage,
});

const EMPTY: Omit<Component, "id" | "user_id" | "created_at" | "updated_at"> = {
  aircraft_profile_id: null,
  ata_chapter: "",
  part_number: "",
  serial_number: "",
  description: "",
  installed_date: null,
  removed_date: null,
  tsn_hours: 0,
  tso_hours: 0,
  cycles_total: 0,
  cycles_since_overhaul: 0,
  hard_time_limit: null,
  status: "installed",
  remarks: "",
};

function ComponentsPage() {
  const [items, setItems] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchComponents().then((data) => { setItems(data); setLoading(false); });
  }, []);

  const submit = async () => {
    if (!form.part_number || !form.description) { toast.error("Part number and description required"); return; }
    setSaving(true);
    try {
      const created = await saveComponent(form);
      await recordAudit("component.create", { resource_type: "component", resource_id: created.id });
      setItems((prev) => [created, ...prev]);
      setForm(EMPTY);
      setShowForm(false);
      toast.success("Component added");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this component?")) return;
    try {
      await deleteComponent(id);
      await recordAudit("component.delete", { resource_type: "component", resource_id: id });
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/account"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <p className="label-overline">Maintenance</p>
            <h1 className="page-title mt-0.5 text-2xl">Component <span className="gold-text">Register</span></h1>
            <p className="page-subtitle">TSN, TSO, and cycle counts per part</p>
          </div>
          <Button variant="action" size="icon" onClick={() => setShowForm((s) => !s)} aria-label="Add component">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showForm && (
          <Card className="p-4 mb-5">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input placeholder="Part number" value={form.part_number} onChange={(e) => setForm((p) => ({ ...p, part_number: e.target.value }))} />
              <Input placeholder="Serial number" value={form.serial_number} onChange={(e) => setForm((p) => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <Input placeholder="Description (e.g., Main wheel assembly)" className="mb-2" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input placeholder="ATA chapter" value={form.ata_chapter} onChange={(e) => setForm((p) => ({ ...p, ata_chapter: e.target.value }))} />
              <Input type="date" value={form.installed_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, installed_date: e.target.value || null }))} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Input type="number" placeholder="TSN" value={form.tsn_hours} onChange={(e) => setForm((p) => ({ ...p, tsn_hours: Number(e.target.value) || 0 }))} />
              <Input type="number" placeholder="TSO" value={form.tso_hours} onChange={(e) => setForm((p) => ({ ...p, tso_hours: Number(e.target.value) || 0 }))} />
              <Input type="number" placeholder="Cycles" value={form.cycles_total} onChange={(e) => setForm((p) => ({ ...p, cycles_total: Number(e.target.value) || 0 }))} />
            </div>
            <Input type="number" placeholder="Hard-time limit (hrs, blank = on-condition)" className="mb-3" value={form.hard_time_limit ?? ""} onChange={(e) => setForm((p) => ({ ...p, hard_time_limit: e.target.value ? Number(e.target.value) : null }))} />
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Component"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </Card>
        )}

        {items.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <Cog className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No components tracked yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => {
              const tr = timeRemaining(c);
              return (
                <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.description}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">P/N {c.part_number} · S/N {c.serial_number || "—"}</p>
                      </div>
                      <button onClick={() => remove(c.id)} aria-label="Delete" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">TSN</p>
                        <p className="font-mono text-foreground">{c.tsn_hours}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">TSO</p>
                        <p className="font-mono text-foreground">{c.tso_hours}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cycles</p>
                        <p className="font-mono text-foreground">{c.cycles_total}</p>
                      </div>
                    </div>
                    {tr.pct != null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Hard-time used</span>
                          <span className="font-mono text-primary">{tr.hours}h remaining</span>
                        </div>
                        <Progress value={tr.pct} className="h-1.5" />
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

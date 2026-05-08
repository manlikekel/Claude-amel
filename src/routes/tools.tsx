import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Wrench, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchTools, saveTool, deleteTool, deriveStatus, type CalibratedTool, type ToolStatus } from "@/lib/tools";
import { recordAudit } from "@/lib/audit";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tool Calibration – AMEL" },
      { name: "description", content: "Track calibration due dates for torque wrenches, gauges and electrical instruments." },
    ],
  }),
  component: ToolsPage,
});

const EMPTY = {
  tool_id: "",
  tool_name: "",
  manufacturer: "",
  serial_number: "",
  category: "torque",
  last_cal_date: null as string | null,
  next_cal_date: "",
  cal_interval_months: 12,
  cal_certificate_url: "",
  remarks: "",
};

function statusPill(s: ToolStatus, days: number | null) {
  if (s === "overdue") return <span className="badge-danger">Overdue {days != null ? `${Math.abs(days)}d` : ""}</span>;
  if (s === "due") return <span className="badge-warning">Due in {days}d</span>;
  if (s === "out_of_service") return <span className="badge-warning">Out of service</span>;
  return <span className="badge-success">In service</span>;
}

function ToolsPage() {
  const [items, setItems] = useState<CalibratedTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTools().then((d) => { setItems(d); setLoading(false); }); }, []);

  const submit = async () => {
    if (!form.tool_name || !form.next_cal_date) { toast.error("Tool name and next calibration date required"); return; }
    setSaving(true);
    try {
      const created = await saveTool(form);
      await recordAudit("tool.create", { resource_type: "tool", resource_id: created.id });
      setItems((p) => [created, ...p]);
      setForm(EMPTY); setShowForm(false);
      toast.success("Tool registered");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this tool?")) return;
    await deleteTool(id);
    setItems((p) => p.filter((t) => t.id !== id));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/account"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <p className="label-overline">Workshop</p>
            <h1 className="page-title mt-0.5 text-2xl">Tool <span className="gold-text">Calibration</span></h1>
            <p className="page-subtitle">Calibration due-date register</p>
          </div>
          <Button variant="action" size="icon" onClick={() => setShowForm((s) => !s)} aria-label="Add tool">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showForm && (
          <Card className="p-4 mb-5">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input placeholder="Asset ID / tag number" value={form.tool_id} onChange={(e) => setForm((p) => ({ ...p, tool_id: e.target.value }))} />
              <Input placeholder="Serial #" value={form.serial_number} onChange={(e) => setForm((p) => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <Input placeholder="Tool name (e.g., Torque wrench 0-150Nm)" className="mb-2" value={form.tool_name} onChange={(e) => setForm((p) => ({ ...p, tool_name: e.target.value }))} />
            <Input placeholder="Manufacturer" className="mb-2" value={form.manufacturer} onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="label-overline mb-1">Last cal.</p>
                <Input type="date" value={form.last_cal_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, last_cal_date: e.target.value || null }))} />
              </div>
              <div>
                <p className="label-overline mb-1">Next due</p>
                <Input type="date" value={form.next_cal_date} onChange={(e) => setForm((p) => ({ ...p, next_cal_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Tool"}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {items.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <Wrench className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tools tracked yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => {
              const status = deriveStatus({ next_cal_date: t.next_cal_date });
              const days = (() => { try { return differenceInDays(new Date(t.next_cal_date), new Date()); } catch { return null; } })();
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{t.tool_name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {t.tool_id || "—"} · {t.manufacturer || "—"} · S/N {t.serial_number || "—"}
                        </p>
                      </div>
                      <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-muted-foreground">Next: <span className="font-mono text-foreground">{t.next_cal_date}</span></p>
                      {statusPill(status, days)}
                    </div>
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

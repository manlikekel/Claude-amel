import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Plane, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchTypeRatings, saveTypeRating, deleteTypeRating, type TypeRating } from "@/lib/type-ratings";
import { recordAudit } from "@/lib/audit";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

export const Route = createFileRoute("/type-ratings")({
  head: () => ({
    meta: [
      { title: "Type Ratings – AMEL" },
      { name: "description", content: "Aircraft type ratings and endorsements." },
    ],
  }),
  component: TypeRatingsPage,
});

const EMPTY = {
  authority: "EASA",
  aircraft_type: "",
  category: "B1.1",
  issue_date: null as string | null,
  expiry_date: null as string | null,
  certificate_no: "",
  practical_assessment_date: null as string | null,
  notes: "",
};

function TypeRatingsPage() {
  const [items, setItems] = useState<TypeRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTypeRatings().then((d) => { setItems(d); setLoading(false); }); }, []);

  const submit = async () => {
    if (!form.aircraft_type) { toast.error("Aircraft type required"); return; }
    setSaving(true);
    try {
      const created = await saveTypeRating(form);
      await recordAudit("type_rating.create", { resource_type: "type_rating", resource_id: created.id });
      setItems((p) => [created, ...p]);
      setForm(EMPTY); setShowForm(false);
      toast.success("Type rating added");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this rating?")) return;
    await deleteTypeRating(id);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/account"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <p className="label-overline">Endorsements</p>
            <h1 className="page-title mt-0.5 text-2xl">Type <span className="gold-text">Ratings</span></h1>
            <p className="page-subtitle">Aircraft type endorsements & assessments</p>
          </div>
          <Button variant="action" size="icon" onClick={() => setShowForm((s) => !s)} aria-label="Add rating">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showForm && (
          <Card className="p-4 mb-5">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input placeholder="Authority (EASA, FAA…)" value={form.authority} onChange={(e) => setForm((p) => ({ ...p, authority: e.target.value }))} />
              <Input placeholder="Category (B1.1, B2…)" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
            </div>
            <Input placeholder="Aircraft type (e.g., B737NG)" className="mb-2" value={form.aircraft_type} onChange={(e) => setForm((p) => ({ ...p, aircraft_type: e.target.value.toUpperCase() }))} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="label-overline mb-1">Issue date</p>
                <Input type="date" value={form.issue_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value || null }))} />
              </div>
              <div>
                <p className="label-overline mb-1">Expiry</p>
                <Input type="date" value={form.expiry_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value || null }))} />
              </div>
            </div>
            <Input placeholder="Certificate # (optional)" className="mb-3" value={form.certificate_no} onChange={(e) => setForm((p) => ({ ...p, certificate_no: e.target.value }))} />
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {items.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <Plane className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No type ratings yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {items.map((r) => {
              const exp = r.expiry_date ? (() => { try { return differenceInDays(new Date(r.expiry_date!), new Date()); } catch { return null; } })() : null;
              const expired = exp != null && exp < 0;
              const expiringSoon = exp != null && exp >= 0 && exp <= 90;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="reg-chip">{r.authority}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{r.category}</span>
                          {expired && <span className="badge-danger">Expired</span>}
                          {expiringSoon && <span className="badge-warning">Expires {exp}d</span>}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{r.aircraft_type}</p>
                        {r.expiry_date && <p className="text-[11px] text-muted-foreground mt-1">Expires {r.expiry_date}</p>}
                      </div>
                      <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
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

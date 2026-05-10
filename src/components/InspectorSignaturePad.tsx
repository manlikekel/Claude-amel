import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { PenLine, RotateCcw, UserCheck, ChevronDown, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SavedInspector {
  id: string;
  name: string;
  authorization_no: string;
  signature_png: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  logId: string;
  onSigned: () => void;
}

export function InspectorSignaturePad({ open, onOpenChange, logId, onSigned }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [name, setName] = useState("");
  const [authNo, setAuthNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [savedInspectors, setSavedInspectors] = useState<SavedInspector[]>([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load saved inspectors
  useEffect(() => {
    if (!open) return;
    supabase
      .from("saved_inspectors" as any)
      .select("id, name, authorization_no, signature_png")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setSavedInspectors((data as SavedInspector[]) ?? []));
  }, [open]);

  // Initialize signature pad after sheet fully opens
  useEffect(() => {
    if (!open) {
      padRef.current?.off();
      padRef.current = null;
      return;
    }
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      const pad = new SignaturePad(canvas, {
        penColor: "#1e3a8a",
        backgroundColor: "rgba(255,255,255,0)",
        minWidth: 1.5,
        maxWidth: 3,
      });
      pad.addEventListener("endStroke", () => setIsEmpty(pad.isEmpty()));
      padRef.current = pad;
      setIsEmpty(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [open]);

  const clearPad = () => {
    padRef.current?.clear();
    padRef.current?.on();
    setIsEmpty(true);
    setSelectedId(null);
  };

  const selectInspector = (inspector: SavedInspector) => {
    setName(inspector.name);
    setAuthNo(inspector.authorization_no);
    setSelectedId(inspector.id);
    setShowPrevious(false);
    // Load the saved signature onto the canvas (read-only)
    padRef.current?.off();
    padRef.current?.fromDataURL(inspector.signature_png);
    setIsEmpty(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Inspector name required"); return; }
    if (!authNo.trim()) { toast.error("Authorization number required"); return; }
    if (!padRef.current || padRef.current.isEmpty()) { toast.error("Please draw or select a signature"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const signaturePng = padRef.current.toDataURL("image/png");

      // Upsert into saved_inspectors
      let inspectorId = selectedId;
      if (!inspectorId) {
        const { data, error } = await supabase
          .from("saved_inspectors" as any)
          .insert({ engineer_user_id: user.id, name: name.trim(), authorization_no: authNo.trim(), signature_png: signaturePng })
          .select("id")
          .single();
        if (error) throw error;
        inspectorId = (data as any).id;
      } else {
        // Update signature in case it was redrawn
        await supabase
          .from("saved_inspectors" as any)
          .update({ signature_png: signaturePng, updated_at: new Date().toISOString() })
          .eq("id", inspectorId);
      }

      // Insert endorsement
      const { error: endErr } = await supabase
        .from("inspector_endorsements" as any)
        .insert({
          log_id: logId,
          inspector_id: inspectorId,
          inspector_name: name.trim(),
          authorization_no: authNo.trim(),
          signature_png: signaturePng,
        });
      if (endErr) throw endErr;

      toast.success(`Inspector sign-off by ${name.trim()} saved`);
      onSigned();
      onOpenChange(false);
      setName("");
      setAuthNo("");
      setSelectedId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save sign-off");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] flex flex-col p-0 rounded-t-2xl">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <UserCheck className="h-4 w-4" />
            Inspector Sign-off
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Previous inspector selector */}
          {savedInspectors.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPrevious((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl glass-subtle px-3 py-2.5 text-sm text-foreground"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedId ? "Inspector selected ✓" : "Select a previous inspector"}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPrevious ? "rotate-180" : ""}`} />
              </button>

              {showPrevious && (
                <div className="mt-2 flex flex-col gap-1.5 rounded-xl glass-subtle p-2">
                  {savedInspectors.map((ins) => (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => selectInspector(ins)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 active:bg-white/10 transition-colors"
                    >
                      <img src={ins.signature_png} alt="" className="h-8 w-20 rounded object-contain bg-white/5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{ins.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{ins.authorization_no}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Signature canvas */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <PenLine className="inline h-3 w-3 mr-1" />
                {selectedId ? "Saved signature (tap Clear to redraw)" : "Draw signature"}
              </label>
              <button
                type="button"
                onClick={clearPad}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Clear
              </button>
            </div>
            <div className="relative rounded-xl border border-dashed border-border/60 bg-white/3 overflow-hidden" style={{ height: 140 }}>
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full touch-none"
              />
              {isEmpty && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="text-[11px] text-muted-foreground/50">Sign here</p>
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Inspector Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          {/* Auth number */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Authorization Number
            </label>
            <Input
              value={authNo}
              onChange={(e) => setAuthNo(e.target.value)}
              placeholder="e.g. QA-2024-0042"
              className="font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-border/40 flex gap-3">
          <Button variant="ghost" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="hero" size="lg" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Save & Sign
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

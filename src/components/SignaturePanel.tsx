/**
 * Digital signature panel for a log entry.
 *
 * - Engineer signs the entry (locks it from edits).
 * - Engineer can request a co-sign from an examiner via email.
 * - Inspector sign-offs via drawn signature pad.
 * - Verified signatures are listed below the form.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, UserCheck, Loader2, Send, Mail, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InspectorSignaturePad } from "@/components/InspectorSignaturePad";
import { fetchSignatures, saveSignature, requestCosign, type LogSignature } from "@/lib/signatures";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface InspectorEndorsement {
  id: string;
  inspector_name: string;
  authorization_no: string;
  signature_png: string;
  endorsed_at: string;
  remarks?: string;
}

export function SignaturePanel({
  logId,
  logPayload,
  signerName,
  signerLicenceNo,
}: {
  logId: string;
  logPayload: any;
  signerName?: string;
  signerLicenceNo?: string;
}) {
  const [sigs, setSigs] = useState<LogSignature[]>([]);
  const [endorsements, setEndorsements] = useState<InspectorEndorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [showCosign, setShowCosign] = useState(false);
  const [examinerEmail, setExaminerEmail] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [padOpen, setPadOpen] = useState(false);

  const fetchAll = async () => {
    const [sigs, { data }] = await Promise.all([
      fetchSignatures(logId),
      supabase.from("inspector_endorsements" as any).select("*").eq("log_id", logId).order("endorsed_at"),
    ]);
    setSigs(sigs);
    setEndorsements((data as InspectorEndorsement[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [logId]);

  const sign = async (role: "engineer" | "examiner" | "qa_inspector") => {
    setSigning(true);
    try {
      await saveSignature(logId, role, logPayload, { signer_name: signerName, signer_licence_no: signerLicenceNo });
      await recordAudit("log.sign", { resource_type: "log", resource_id: logId, metadata: { role } });
      const fresh = await fetchSignatures(logId);
      setSigs(fresh);
      toast.success(`${role === "engineer" ? "Engineer" : role === "examiner" ? "Examiner" : "QA inspector"} signature applied — entry locked`);
    } catch (e: any) {
      toast.error(e?.message ?? "Signing failed");
    } finally {
      setSigning(false);
    }
  };

  const submitCosign = async () => {
    if (!examinerEmail) { toast.error("Examiner email required"); return; }
    setRequesting(true);
    try {
      await requestCosign(logId, examinerEmail);
      await recordAudit("log.cosign_request", { resource_type: "log", resource_id: logId, metadata: { examiner_email: examinerEmail } });
      toast.success("Co-sign request sent");
      setShowCosign(false);
      setExaminerEmail("");
    } catch (e: any) {
      toast.error(e?.message ?? "Request failed");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </Card>
    );
  }

  const hasEngineerSig = sigs.some((s) => s.role === "engineer");
  const hasExaminerSig = sigs.some((s) => s.role === "examiner");

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="label-overline">Digital Signatures</p>
      </div>

      {sigs.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {sigs.map((s) => (
            <div key={s.id} className="rounded-lg glass-subtle p-3">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold capitalize">{s.role}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {format(new Date(s.signed_at), "PP HH:mm")}
                </span>
              </div>
              <p className="text-[11px] text-foreground">{s.signer_name || "Unnamed signer"}</p>
              {s.signer_licence_no && <p className="text-[10px] font-mono text-muted-foreground">Lic. {s.signer_licence_no}</p>}
              <p className="mt-1 text-[10px] font-mono text-muted-foreground break-all">
                Hash: {s.log_hash.slice(0, 24)}…
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {!hasEngineerSig && (
          <Button variant="hero" size="sm" onClick={() => sign("engineer")} disabled={signing}>
            {signing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Sign as Engineer (locks entry)
          </Button>
        )}

        {hasEngineerSig && !hasExaminerSig && !showCosign && (
          <Button variant="action" size="sm" onClick={() => setShowCosign(true)}>
            <Send className="h-3.5 w-3.5" />
            Request Examiner Co-Sign
          </Button>
        )}

        {showCosign && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="examiner@authority.gov"
                value={examinerEmail}
                onChange={(e) => setExaminerEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="hero" size="sm" className="flex-1" onClick={submitCosign} disabled={requesting}>
                {requesting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send request"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCosign(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {hasEngineerSig && (
          <Button variant="ghost" size="sm" onClick={() => sign("examiner")} disabled={signing}>
            <UserCheck className="h-3.5 w-3.5" />
            Sign as Examiner (this device)
          </Button>
        )}
      </div>

      {/* Inspector sign-offs */}
      <div className="mt-4 pt-3 border-t border-border/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspector Sign-offs</p>
          </div>
          <Button variant="action" size="sm" className="h-7 px-2.5 text-[10px] gap-1" onClick={() => setPadOpen(true)}>
            <PenLine className="h-3 w-3" /> Add
          </Button>
        </div>

        {endorsements.length > 0 ? (
          <div className="flex flex-col gap-2">
            {endorsements.map((e) => (
              <div key={e.id} className="rounded-lg glass-subtle p-3 flex items-center gap-3">
                <img
                  src={e.signature_png}
                  alt={`${e.inspector_name} signature`}
                  className="h-10 w-24 rounded object-contain bg-white/5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{e.inspector_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{e.authorization_no}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(e.endorsed_at), "PP HH:mm")}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No inspector sign-offs yet.</p>
        )}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Engineer signatures use ECDSA P-256 over a SHA-256 hash of the canonical entry. The public key is embedded so any third party can verify independently.
      </p>

      <InspectorSignaturePad
        open={padOpen}
        onOpenChange={setPadOpen}
        logId={logId}
        onSigned={fetchAll}
      />
    </Card>
  );
}

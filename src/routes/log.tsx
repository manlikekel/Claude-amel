import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, RotateCcw, Loader2, Search as SearchIcon, Trash2, CheckCircle2, Mic, Square, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  saveLog, updateLog, deleteLog, fetchLog,
  findAircraftByRegistration, upsertAircraftProfile,
  fetchProfile,
  ATA_CHAPTERS,
  type LogVisibility,
} from "@/lib/data";
import { fetchMyOrganizations, type OrganizationMembership } from "@/lib/organizations";
import { lookupAircraft } from "@/lib/aircraft-lookup.functions";
import { normalizeRegistration, looksLikeRegistration } from "@/lib/aircraft";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/log")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Log Entry – AMEL" }, { name: "description", content: "Create or edit a maintenance log entry." }],
  }),
  component: LogEntryPage,
});

function LogEntryPage() {
  const navigate = useNavigate();
  const { id: editId } = Route.useSearch();
  const isEdit = Boolean(editId);

  const [form, setForm] = useState({
    aircraft_profile_id: null as string | null,
    aircraft_model: "",
    manufacturer: "",
    registration: "",
    ata_chapter: "",
    fault_description: "",
    symptoms: [] as string[],
    root_cause: "",
    action_taken: "",
    tools_used: "",
    time_hours: "",
    time_minutes: "",
    is_recurring: false,
    work_date: toLocalDateTimeInput(new Date()),
    system_component: "",
    maintenance_reference: "",
    share_to_community: true,
    visibility: "personal" as LogVisibility,
    organization_id: null as string | null,
  });
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [showShareInfo, setShowShareInfo] = useState(false);
  const [symptomInput, setSymptomInput] = useState("");
  const [ataSearch, setAtaSearch] = useState("");
  const [showAtaDropdown, setShowAtaDropdown] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not_found" | "error">("idle");
  const [lookupSource, setLookupSource] = useState<string | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [suggestingAta, setSuggestingAta] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        await transcribeBlob(blob, mr.mimeType || "audio/webm");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeBlob = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    try {
      const base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audio: base64, mimeType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const transcript = (data?.text ?? "").trim();
      if (!transcript) { toast.error("Couldn't pick anything up — try again"); return; }
      // Append to fault description first so user always sees raw transcript
      setForm((p) => ({
        ...p,
        fault_description: p.fault_description ? `${p.fault_description}\n${transcript}` : transcript,
      }));
      toast.success("Transcribed — parsing…");
      // Then run AI parser to extract structured fields
      try {
        const { data: parsed, error: pErr } = await supabase.functions.invoke("parse-log-voice", {
          body: { transcript, chapters: ATA_CHAPTERS },
        });
        if (pErr) throw pErr;
        if (parsed?.error) throw new Error(parsed.error);
        setForm((p) => ({
          ...p,
          registration: parsed.registration?.toUpperCase() || p.registration,
          aircraft_model: parsed.aircraft_model?.toUpperCase() || p.aircraft_model,
          manufacturer: parsed.manufacturer?.toUpperCase() || p.manufacturer,
          ata_chapter: parsed.ata_chapter || p.ata_chapter,
          fault_description: parsed.fault_description?.toUpperCase() || p.fault_description,
          action_taken: parsed.action_taken?.toUpperCase() || p.action_taken,
          root_cause: parsed.root_cause?.toUpperCase() || p.root_cause,
          system_component: parsed.system_component?.toUpperCase() || p.system_component,
          maintenance_reference: parsed.maintenance_reference?.toUpperCase() || p.maintenance_reference,
          symptoms: Array.isArray(parsed.symptoms) && parsed.symptoms.length > 0
            ? Array.from(new Set([...p.symptoms, ...parsed.symptoms.map((s: string) => s.toUpperCase())]))
            : p.symptoms,
        }));
        // Auto-trigger registration lookup if we got one
        if (parsed.registration) setTimeout(() => runLookup(parsed.registration), 100);
        toast.success("Form pre-filled from voice");
      } catch (e: any) {
        console.error("parse failed", e);
        // Non-fatal — transcript is already in fault_description
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const suggestAta = async () => {
    if (!form.fault_description.trim()) { toast.error("Add a fault description first"); return; }
    setSuggestingAta(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-ata", {
        body: { fault: form.fault_description, chapters: ATA_CHAPTERS },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.chapter && ATA_CHAPTERS.includes(data.chapter)) {
        update("ata_chapter", data.chapter);
        setAtaSearch("");
        toast.success(`Suggested: ${data.chapter}`, { description: data.reasoning });
      } else {
        toast.error("No suitable chapter found");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Suggestion failed");
    } finally {
      setSuggestingAta(false);
    }
  };


  // Load existing log if editing
  useEffect(() => {
    if (!editId) return;
    fetchLog(editId).then((log) => {
      if (!log) { toast.error("Log not found"); navigate({ to: "/" }); return; }
      setForm({
        aircraft_profile_id: log.aircraft_profile_id,
        aircraft_model: log.aircraft_model,
        manufacturer: log.manufacturer,
        registration: log.registration,
        ata_chapter: log.ata_chapter,
        fault_description: log.fault_description,
        symptoms: log.symptoms,
        root_cause: log.root_cause,
        action_taken: log.action_taken,
        tools_used: log.tools_used,
        time_hours: log.time_spent_hours ? String(Math.floor(log.time_spent_hours)) : "",
        time_minutes: log.time_spent_hours ? String(Math.round((log.time_spent_hours % 1) * 60)) : "",
        is_recurring: log.is_recurring,
        work_date: toLocalDateTimeInput(new Date(log.created_at)),
        system_component: log.system_component ?? "",
        maintenance_reference: log.maintenance_reference ?? "",
        share_to_community: log.share_to_community ?? true,
        visibility: (log.visibility as LogVisibility) ?? "personal",
        organization_id: log.organization_id ?? null,
      });
      setLoadingEntry(false);
    });
  }, [editId, navigate]);

  // Load orgs + active org so the visibility selector can offer team mode
  useEffect(() => {
    (async () => {
      try {
        const [mems, prof] = await Promise.all([fetchMyOrganizations(), fetchProfile()]);
        setMemberships(mems);
        setActiveOrgId(prof.active_organization_id ?? null);
        if (!isEdit) {
          // Default visibility = public_anon when user has accepted global sharing.
          // Also keep share_to_community in sync with their profile default.
          const sharesGlobally = prof.share_to_community_default ?? true;
          setForm((p) => ({
            ...p,
            visibility: sharesGlobally ? "public_anon" : p.visibility,
            share_to_community: sharesGlobally,
            organization_id: p.organization_id ?? prof.active_organization_id ?? null,
          }));
        }
      } catch (e) { console.error(e); }
    })();
  }, [isEdit]);

  // First-time community-share prompt (shown once, only on a new entry)
  useEffect(() => {
    if (isEdit) return;
    try {
      if (!localStorage.getItem("amel.share_prompt_seen")) {
        setShowShareInfo(true);
        localStorage.setItem("amel.share_prompt_seen", "1");
      }
    } catch { /* ignore */ }
  }, [isEdit]);

  const update = useCallback(
    (field: string, value: string | boolean | string[] | null) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  // Aircraft lookup — triggered on blur or button
  const runLookup = useCallback(async (regRaw: string) => {
    const reg = regRaw.trim();
    if (!reg || !looksLikeRegistration(reg)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.message("Offline mode: online lookup unavailable. You can continue manually.");
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    try {
      // Check our own profile cache first
      const existing = await findAircraftByRegistration(reg);
      if (existing) {
        setForm((p) => ({
          ...p,
          aircraft_profile_id: existing.id,
          aircraft_model: p.aircraft_model || existing.model || "",
          manufacturer: p.manufacturer || existing.manufacturer || "",
        }));
        setLookupSource(existing.lookup_source);
        setLookupState("found");
        return;
      }

      const res = await lookupAircraft({ data: { registration: reg } });
      if (res.status === "found") {
        setForm((p) => ({
          ...p,
          aircraft_model: p.aircraft_model || res.model || "",
          manufacturer: p.manufacturer || res.manufacturer || "",
        }));
        setLookupSource(res.source);
        setLookupState("found");

        // Persist a profile so we don't re-fetch
        try {
          const prof = await upsertAircraftProfile({
            registration: reg,
            model: res.model,
            manufacturer: res.manufacturer,
            aircraft_type_code: res.aircraft_type_code,
            icao24: res.icao24,
            serial_number: res.serial_number,
            operator_name: res.operator_name,
            lookup_source: res.source,
            lookup_status: res.status,
          });
          setForm((p) => ({ ...p, aircraft_profile_id: prof.id }));
        } catch (e) { console.error(e); }
      } else {
        setLookupState("not_found");
      }
    } catch (e) {
      console.error(e);
      setLookupState("error");
    }
  }, []);

  const addSymptom = () => {
    const tag = symptomInput.trim();
    if (tag && !form.symptoms.includes(tag)) {
      update("symptoms", [...form.symptoms, tag]);
      setSymptomInput("");
    }
  };

  const removeSymptom = (s: string) => update("symptoms", form.symptoms.filter((x) => x !== s));

  const handleSave = async () => {
    if (!form.fault_description) { toast.error("Add a fault description"); return; }
    setSaving(true);
    try {
      const up = (s: string) => (s || "").toUpperCase();
      const payload = {
        aircraft_profile_id: form.aircraft_profile_id,
        registration: form.registration ? normalizeRegistration(form.registration) : "",
        aircraft_model: up(form.aircraft_model),
        manufacturer: up(form.manufacturer),
        ata_chapter: up(form.ata_chapter),
        fault_description: up(form.fault_description),
        symptoms: form.symptoms.map(up),
        root_cause: up(form.root_cause),
        action_taken: up(form.action_taken),
        tools_used: up(form.tools_used),
        time_spent_hours: (parseInt(form.time_hours) || 0) + (parseInt(form.time_minutes) || 0) / 60,
        image_urls: [] as string[],
        voice_note_url: null as string | null,
        is_recurring: form.is_recurring,
        created_at: form.work_date ? new Date(form.work_date).toISOString() : null,
        system_component: up(form.system_component),
        maintenance_reference: up(form.maintenance_reference),
        share_to_community: form.share_to_community,
        visibility: form.visibility,
        organization_id: form.visibility === "team" ? (form.organization_id ?? activeOrgId) : null,
      };
      if (isEdit && editId) {
        await updateLog(editId, payload);
        toast.success("Log updated");
      } else {
        await saveLog(payload);
        toast.success("Log saved");
      }
      // Subtle success pulse before navigating
      const root = document.getElementById("amel-app-root");
      if (root) {
        root.classList.add("animate-save-pulse");
        setTimeout(() => root.classList.remove("animate-save-pulse"), 720);
      }
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId || !confirm("Delete this log entry?")) return;
    try {
      await deleteLog(editId);
      toast.success("Log deleted");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  const filteredAta = ATA_CHAPTERS.filter((a) => a.toLowerCase().includes(ataSearch.toLowerCase()));

  if (loadingEntry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="mx-auto max-w-lg px-5 pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <p className="label-overline">{isEdit ? "Editing" : "New"}</p>
            <h1 className="font-display text-xl font-bold tracking-tight">
              {isEdit ? "Edit Log " : "Log "}<span className="gold-text">Entry</span>
            </h1>
          </div>
          {isEdit && (
            <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          {/* Registration FIRST — drives lookup */}
          <FieldGroup label="Registration / Tail Number">
            <div className="flex gap-2">
              <Input
                value={form.registration}
                placeholder="e.g. 5N-XEL"
                onChange={(e) => { update("registration", e.target.value.toUpperCase()); setLookupState("idle"); }}
                onBlur={(e) => runLookup(e.target.value)}
                className="uppercase"
              />
              <Button
                variant="action"
                size="default"
                onClick={() => runLookup(form.registration)}
                disabled={!form.registration || lookupState === "loading"}
                title="Search aircraft database"
              >
                {lookupState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              </Button>
            </div>
            {lookupState === "loading" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Looking up aircraft…
              </p>
            )}
            {lookupState === "found" && (
              <p className="mt-1.5 text-[11px] text-primary flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> Auto-filled from {lookupSource ?? "database"}
              </p>
            )}
            {lookupState === "not_found" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">No database match. Enter model manually.</p>
            )}
            {lookupState === "error" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Lookup failed. Enter model manually.</p>
            )}
          </FieldGroup>

          <FieldGroup label="Aircraft Model">
            <Input
              value={form.aircraft_model}
              placeholder="e.g. CRJ200"
              onChange={(e) => update("aircraft_model", e.target.value)}
              className="uppercase placeholder:normal-case"
            />
          </FieldGroup>

          <FieldGroup label="Manufacturer (optional)">
            <Input
              value={form.manufacturer}
              placeholder="e.g. Bombardier"
              onChange={(e) => update("manufacturer", e.target.value)}
              className="uppercase placeholder:normal-case"
            />
          </FieldGroup>

          <FieldGroup label="ATA Chapter">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={form.ata_chapter || ataSearch}
                  placeholder="e.g. 21 – Air Conditioning"
                  onFocus={() => setShowAtaDropdown(true)}
                  onChange={(e) => { setAtaSearch(e.target.value); update("ata_chapter", ""); setShowAtaDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowAtaDropdown(false), 150)}
                />
                {showAtaDropdown && filteredAta.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl surface-opaque p-1">
                    {filteredAta.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                        onMouseDown={() => { update("ata_chapter", a); setAtaSearch(""); setShowAtaDropdown(false); }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="action"
                size="default"
                onClick={suggestAta}
                disabled={suggestingAta || !form.fault_description.trim()}
                title="AI suggest from fault description"
              >
                {suggestingAta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Tip: Write the fault first, then tap ✨ to let AI pick the chapter.</p>
          </FieldGroup>

          <FieldGroup label="Fault Description">
            <div className="relative">
              <textarea
                value={form.fault_description}
                placeholder="What exactly happened? (EICAS, symptoms, conditions) — or tap the mic to dictate"
                onChange={(e) => update("fault_description", e.target.value)}
                rows={4}
                className="amel-textarea pr-12 uppercase"
              />
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                title={recording ? "Stop recording" : "Dictate fault"}
                className={`absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                  recording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "glass-subtle text-primary hover:gold-glow-sm"
                }`}
              >
                {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
            {recording && <p className="mt-1.5 text-[11px] text-destructive">● Recording… tap stop when done.</p>}
            {transcribing && <p className="mt-1.5 text-[11px] text-muted-foreground">Transcribing your voice…</p>}
          </FieldGroup>

          <FieldGroup label="Symptoms">
            <div className="flex gap-2">
              <Input
                value={symptomInput}
                placeholder="Add tags (low pressure, high EGT…)"
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSymptom())}
                className="uppercase placeholder:normal-case"
              />
              <Button variant="secondary" size="default" onClick={addSymptom}>Add</Button>
            </div>
            {form.symptoms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.symptoms.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full glass-subtle px-2.5 py-0.5 text-xs font-medium uppercase text-primary">
                    {s}
                    <button onClick={() => removeSymptom(s)} className="ml-0.5 text-primary/60 hover:text-primary">×</button>
                  </span>
                ))}
              </div>
            )}
          </FieldGroup>

          <FieldGroup label="Root Cause">
            <Input value={form.root_cause} placeholder="What was the actual issue?" onChange={(e) => update("root_cause", e.target.value)} className="uppercase placeholder:normal-case" />
          </FieldGroup>

          <FieldGroup label="Action Taken">
            <textarea
              value={form.action_taken}
              placeholder="What did you do to fix it?"
              onChange={(e) => update("action_taken", e.target.value)}
              rows={2}
              className="amel-textarea uppercase"
            />
          </FieldGroup>

          <FieldGroup label="System / Component (optional)">
            <Input
              value={form.system_component}
              placeholder="e.g. air conditioning system, ram air fan, landing gear"
              onChange={(e) => update("system_component", e.target.value)}
              className="uppercase placeholder:normal-case"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Improves NCAA O-PEL-020 wording.</p>
          </FieldGroup>

          <FieldGroup label="Maintenance Reference (optional)">
            <Input
              value={form.maintenance_reference}
              placeholder="e.g. AMM 21-51-00, FIM 21-00-00, SRM 32-00-00"
              onChange={(e) => update("maintenance_reference", e.target.value)}
              className="uppercase placeholder:normal-case"
            />
          </FieldGroup>

          <FieldGroup label="Tools / Manual Used">
            <Input value={form.tools_used} placeholder="Manual, AMM ref, tools used" onChange={(e) => update("tools_used", e.target.value)} className="uppercase placeholder:normal-case" />
          </FieldGroup>

          <FieldGroup label="Time Spent">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={form.time_hours}
                  placeholder="Hours"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  onChange={(e) => update("time_hours", e.target.value.replace(/[^0-9]/g, ""))}
                />
                <p className="mt-1 text-[10px] text-muted-foreground text-center">Hours</p>
              </div>
              <div className="flex-1">
                <Input
                  value={form.time_minutes}
                  placeholder="Minutes"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  inputMode="numeric"
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    const n = v === "" ? "" : String(Math.min(59, parseInt(v)));
                    update("time_minutes", n);
                  }}
                />
                <p className="mt-1 text-[10px] text-muted-foreground text-center">Minutes</p>
              </div>
            </div>
          </FieldGroup>

          <FieldGroup label="Date & Time of Work">
            <Input
              type="datetime-local"
              value={form.work_date}
              onChange={(e) => update("work_date", e.target.value)}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Defaults to now. Adjust if you're back-logging an older job.</p>
          </FieldGroup>

          <button
            onClick={() => update("is_recurring", !form.is_recurring)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
              form.is_recurring ? "glass border-primary/40 text-primary gold-glow-sm" : "glass-subtle text-muted-foreground"
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            Mark as Recurring
          </button>

          <div className="rounded-xl glass-subtle p-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Share anonymously to AMEL knowledge base</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Helps other engineers troubleshoot. Your name, email, and full registration are never shared.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.share_to_community}
              data-on={form.share_to_community ? "true" : "false"}
              onClick={() => update("share_to_community", !form.share_to_community)}
              className="amel-switch"
            />

          </div>

          {/* Visibility selector */}
          <FieldGroup label="Visibility">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: "personal", label: "Personal" },
                { id: "team", label: "Team" },
                { id: "public_anon", label: "Public" },
              ] as { id: LogVisibility; label: string }[]).map((opt) => {
                const disabled = opt.id === "team" && memberships.length === 0;
                const active = form.visibility === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => update("visibility", opt.id)}
                    className={`rounded-xl px-2 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                      active
                        ? "gold-gradient text-primary-foreground gold-glow-sm"
                        : disabled
                        ? "glass-subtle text-muted-foreground/40 cursor-not-allowed"
                        : "glass-subtle text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {form.visibility === "team" && memberships.length > 1 && (
              <select
                value={form.organization_id ?? activeOrgId ?? ""}
                onChange={(e) => update("organization_id", e.target.value || null)}
                className="mt-2 w-full rounded-xl border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
              >
                {memberships.map((m) => (
                  <option key={m.organization_id} value={m.organization_id}>
                    {m.organizations?.name ?? "Team"}
                  </option>
                ))}
              </select>
            )}
            {form.visibility === "team" && memberships.length === 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Join or create a team in Account to use this.</p>
            )}
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {form.visibility === "personal" && "Only you can see this log."}
              {form.visibility === "team" && "Visible to all members of the selected team."}
              {form.visibility === "public_anon" && "Anonymized version added to global knowledge base (controlled by share toggle below)."}
            </p>
          </FieldGroup>

          <Button
            variant="hero"
            size="xl"
            className="mt-2 w-full"
            onClick={handleSave}
            disabled={saving || !form.fault_description}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Update Log" : "Save Log"}
          </Button>
        </motion.div>
      </div>

      {/* First-time community-share onboarding */}
      {showShareInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowShareInfo(false)}>
          <div className="w-full max-w-md rounded-2xl surface-opaque p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary">Help engineers worldwide</h3>
            <p className="mt-2 text-sm text-foreground">
              Your logs can be shared <strong>anonymously</strong> to help other AMEs solve similar issues faster.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Name, email, phone and exact registration are <strong>never</strong> shared. You can turn this off any time per-log or in Account.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { update("share_to_community", false); setShowShareInfo(false); }}>
                Turn off
              </Button>
              <Button variant="hero" className="flex-1" onClick={() => setShowShareInfo(false)}>
                Continue sharing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:audio/webm;base64,"
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

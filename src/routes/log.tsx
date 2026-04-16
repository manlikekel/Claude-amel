import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { ArrowLeft, Camera, Mic, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { saveLog, AIRCRAFT_TYPES, ATA_CHAPTERS } from "@/lib/store";
import { motion } from "framer-motion";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "New Log Entry – AMEL" },
      { name: "description", content: "Create a new maintenance log entry." },
    ],
  }),
  component: LogEntryPage,
});

function LogEntryPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    aircraft_type: "",
    registration: "",
    ata_chapter: "",
    fault_description: "",
    symptoms: [] as string[],
    root_cause: "",
    action_taken: "",
    tools_used: "",
    time_spent: "",
    is_recurring: false,
  });
  const [symptomInput, setSymptomInput] = useState("");
  const [ataSearch, setAtaSearch] = useState("");
  const [showAtaDropdown, setShowAtaDropdown] = useState(false);
  const [showAircraftDropdown, setShowAircraftDropdown] = useState(false);

  const update = useCallback(
    (field: string, value: string | boolean | string[]) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  const addSymptom = () => {
    const tag = symptomInput.trim();
    if (tag && !form.symptoms.includes(tag)) {
      update("symptoms", [...form.symptoms, tag]);
      setSymptomInput("");
    }
  };

  const removeSymptom = (s: string) => {
    update("symptoms", form.symptoms.filter((x) => x !== s));
  };

  const handleSave = () => {
    if (!form.aircraft_type || !form.fault_description) return;
    saveLog({
      aircraft_type: form.aircraft_type,
      registration: form.registration,
      ata_chapter: form.ata_chapter,
      fault_description: form.fault_description,
      symptoms: form.symptoms,
      root_cause: form.root_cause,
      action_taken: form.action_taken,
      tools_used: form.tools_used,
      time_spent: parseFloat(form.time_spent) || 0,
      images: [],
      is_recurring: form.is_recurring,
    });
    navigate({ to: "/" });
  };

  const filteredAta = ATA_CHAPTERS.filter((a) =>
    a.toLowerCase().includes(ataSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-5 pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">New Log Entry</h1>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          {/* Aircraft Type */}
          <FieldGroup label="Aircraft Type">
            <div className="relative">
              <Input
                value={form.aircraft_type}
                placeholder="Select aircraft"
                onFocus={() => setShowAircraftDropdown(true)}
                onChange={(e) => {
                  update("aircraft_type", e.target.value);
                  setShowAircraftDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowAircraftDropdown(false), 150)}
              />
              {showAircraftDropdown && (
                <Card className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto p-1">
                  {AIRCRAFT_TYPES.filter((a) =>
                    a.toLowerCase().includes(form.aircraft_type.toLowerCase())
                  ).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                      onMouseDown={() => {
                        update("aircraft_type", a);
                        setShowAircraftDropdown(false);
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </Card>
              )}
            </div>
          </FieldGroup>

          {/* Registration */}
          <FieldGroup label="Registration">
            <Input
              value={form.registration}
              placeholder="e.g. 5N-XXX"
              onChange={(e) => update("registration", e.target.value)}
            />
          </FieldGroup>

          {/* ATA Chapter */}
          <FieldGroup label="ATA Chapter">
            <div className="relative">
              <Input
                value={form.ata_chapter || ataSearch}
                placeholder="e.g. 21 – Air Conditioning"
                onFocus={() => setShowAtaDropdown(true)}
                onChange={(e) => {
                  setAtaSearch(e.target.value);
                  update("ata_chapter", "");
                  setShowAtaDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowAtaDropdown(false), 150)}
              />
              {showAtaDropdown && filteredAta.length > 0 && (
                <Card className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto p-1">
                  {filteredAta.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                      onMouseDown={() => {
                        update("ata_chapter", a);
                        setAtaSearch("");
                        setShowAtaDropdown(false);
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </Card>
              )}
            </div>
          </FieldGroup>

          {/* Fault Description */}
          <FieldGroup label="Fault Description">
            <div className="relative">
              <textarea
                value={form.fault_description}
                placeholder="What exactly happened? (EICAS, symptoms, conditions)"
                onChange={(e) => update("fault_description", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button variant="ghost" size="icon" className="absolute right-1 top-1 text-primary" title="Voice input">
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </FieldGroup>

          {/* Symptoms */}
          <FieldGroup label="Symptoms">
            <div className="flex gap-2">
              <Input
                value={symptomInput}
                placeholder="Add quick tags (low pressure, high EGT…)"
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSymptom())}
              />
              <Button variant="secondary" size="default" onClick={addSymptom}>
                Add
              </Button>
            </div>
            {form.symptoms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.symptoms.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {s}
                    <button onClick={() => removeSymptom(s)} className="ml-0.5 text-primary/60 hover:text-primary">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </FieldGroup>

          {/* Root Cause */}
          <FieldGroup label="Root Cause">
            <Input
              value={form.root_cause}
              placeholder="What was the actual issue?"
              onChange={(e) => update("root_cause", e.target.value)}
            />
          </FieldGroup>

          {/* Action Taken */}
          <FieldGroup label="Action Taken">
            <textarea
              value={form.action_taken}
              placeholder="What did you do to fix it?"
              onChange={(e) => update("action_taken", e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </FieldGroup>

          {/* Tools Used */}
          <FieldGroup label="Tools / Manual Used">
            <Input
              value={form.tools_used}
              placeholder="Manual, AMM ref, tools used"
              onChange={(e) => update("tools_used", e.target.value)}
            />
          </FieldGroup>

          {/* Time Spent */}
          <FieldGroup label="Time Spent (hours)">
            <Input
              value={form.time_spent}
              placeholder="e.g. 1.5"
              type="number"
              step="0.5"
              onChange={(e) => update("time_spent", e.target.value)}
            />
          </FieldGroup>

          {/* Extras */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <Button variant="action" size="icon-lg" title="Add Photo">
                <Camera className="h-5 w-5" />
              </Button>
              <Button variant="action" size="icon-lg" title="Voice Input">
                <Mic className="h-5 w-5" />
              </Button>
            </div>
            <button
              onClick={() => update("is_recurring", !form.is_recurring)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                form.is_recurring
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              Recurring
            </button>
          </div>

          {/* Save */}
          <Button
            variant="hero"
            size="xl"
            className="mt-2 w-full"
            onClick={handleSave}
            disabled={!form.aircraft_type || !form.fault_description}
          >
            Save Log
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

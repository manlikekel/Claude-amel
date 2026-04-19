import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Search, BarChart3, User, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_PREFIX = "amel_onboarding_seen_";

const STEPS = [
  {
    icon: Plane,
    title: "Welcome to AMEL",
    body: "Your premium engineering memory. Log every maintenance task once — find it forever.",
  },
  {
    icon: Plane,
    title: "Logbook",
    body: "Tap 'Log New Task' to record a job. Just type the registration — model, manufacturer & operator auto-fill from public databases.",
  },
  {
    icon: Search,
    title: "Search",
    body: "Need to recall how you fixed a fault before? Search across every entry by aircraft, ATA chapter, fault, or action.",
  },
  {
    icon: BarChart3,
    title: "Experience",
    body: "Track hours per aircraft, ATA coverage, manage licences & ratings, and export a polished landscape PDF logbook.",
  },
  {
    icon: User,
    title: "Account",
    body: "Fill in your name and AME licence number first — they appear on every PDF export. Then add your licences in Experience.",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const key = STORAGE_PREFIX + user.id;
    if (!localStorage.getItem(key)) {
      // small delay so the app renders behind it first
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [user]);

  const finish = () => {
    if (user) localStorage.setItem(STORAGE_PREFIX + user.id, "1");
    setOpen(false);
    setStep(0);
  };

  if (!open) return null;

  const Step = STEPS[step];
  const Icon = Step.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-background/85 backdrop-blur-md"
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-sm rounded-3xl glass p-6 gold-glow-sm"
        >
          <button
            onClick={finish}
            className="absolute right-3 top-3 p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl glass-subtle gold-glow-sm">
            <Icon className="h-6 w-6 text-primary" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">{Step.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{Step.body}</p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>
            <Button
              variant="hero"
              size="sm"
              onClick={() => (isLast ? finish() : setStep(step + 1))}
              className="gap-1.5"
            >
              {isLast ? "Get started" : "Next"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <button
            onClick={finish}
            className="mt-3 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

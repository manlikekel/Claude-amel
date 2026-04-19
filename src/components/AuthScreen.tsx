import { useState } from "react";
import { Plane, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const friendlyError = (err: any): string => {
    const msg = String(err?.message ?? "").toLowerCase();
    const code = String(err?.code ?? err?.error_code ?? "").toLowerCase();
    if (code.includes("weak_password") || msg.includes("weak") || msg.includes("pwned")) {
      return "That password is too common and has appeared in data breaches. Try a longer passphrase with mixed words, numbers and symbols.";
    }
    if (msg.includes("invalid login")) {
      return "Email or password is incorrect. If you just signed up, please confirm your email first.";
    }
    if (msg.includes("already registered") || msg.includes("user already")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email address first — check your inbox for the verification link.";
    }
    if (msg.includes("failed to fetch")) {
      return "Network issue reaching the server. If you're on the preview, try the published app URL.";
    }
    return err?.message ?? "Authentication failed";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created successfully — welcome to AMEL!");
        } else {
          toast.success("Account created successfully! Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login successful — welcome back!");
      }
    } catch (err: any) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-72 w-96 rounded-full bg-primary/8 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-wine/40 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl glass mb-3 gold-glow-sm">
            <Plane className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary drop-shadow-[0_0_12px_oklch(0.78_0.12_80/0.3)]">AMEL</h1>
          <p className="text-sm text-muted-foreground mt-1">Your engineering memory</p>
        </div>

        <Card className="p-6">
          <div className="flex gap-1 mb-5 p-1 rounded-xl glass-subtle">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <Input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPwd ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" variant="hero" size="lg" disabled={busy} className="mt-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground mt-4">
          By continuing you agree to log your maintenance work securely.
        </p>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { Plane, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "signin" | "signup" | "forgot";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const friendlyError = (err: any, ctx: Mode): string => {
    const msg = String(err?.message ?? "").toLowerCase();
    const code = String(err?.code ?? err?.error_code ?? "").toLowerCase();
    if (code.includes("weak_password") || msg.includes("weak") || msg.includes("pwned")) {
      return "That password is too common and has appeared in data breaches. Try a longer passphrase.";
    }
    if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
      return "Invalid username or password";
    }
    if (msg.includes("already registered") || msg.includes("user already")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email address first — check your inbox for the verification link.";
    }
    if (msg.includes("failed to fetch")) {
      return "Network issue reaching the server.";
    }
    if (ctx === "signin") return "Invalid username or password";
    return err?.message ?? "Authentication failed";
  };

  const submitSignIn = async () => {
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login successful");
      // AuthGate will swap content automatically
    } catch (err: any) {
      toast.error(friendlyError(err, "signin"));
    } finally {
      setBusy(false);
    }
  };

  const submitSignUp = async () => {
    if (password.length < 8) { toast.error("Use at least 8 characters for your password"); return; }
    setBusy(true);
    try {
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
        toast.success("Account created — welcome to AMEL!");
      } else {
        toast.success("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(friendlyError(err, "signup"));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    if (!email) { toast.error("Enter your email"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
      setMode("signin");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send reset email");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") return submitSignIn();
    if (mode === "signup") return submitSignUp();
    return submitForgot();
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
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl glass mb-4 gold-glow-sm border-primary/20">
            <Plane className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-[40px] font-extrabold tracking-tight leading-none">
            AM<span className="gold-text">EL</span>
          </h1>
          <p className="text-[13px] text-muted-foreground mt-2 tracking-wide">
            Aircraft Maintenance Engineer Logbook
          </p>
        </div>

        <Card className="p-6">
          {mode !== "forgot" ? (
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
          ) : (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
          )}

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              onSubmit={submit}
              className="flex flex-col gap-3"
            >
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

              {mode !== "forgot" && (
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    placeholder={mode === "signup" ? "Password (min 8 chars)" : "Password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
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
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="self-end -mt-1 text-xs font-medium text-primary hover:underline underline-offset-2"
                >
                  Forgot password?
                </button>
              )}

              <Button type="submit" variant="hero" size="lg" disabled={busy} className="mt-2 transition-transform active:scale-[0.98]">
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "signin" && "Sign In"}
                {mode === "signup" && "Create Account"}
                {mode === "forgot" && "Send reset link"}
              </Button>
            </motion.form>
          </AnimatePresence>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground mt-4">
          By continuing you agree to log your maintenance work securely.
        </p>
      </motion.div>
    </div>
  );
}

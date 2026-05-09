import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Loader2, ArrowLeft, Plus, LogIn, Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchMyOrganizations,
  createOrganization,
  joinOrganizationBySlug,
  leaveOrganization,
  setActiveOrganization,
  type OrganizationMembership,
} from "@/lib/organizations";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team – AMEL" }] }),
  component: TeamPage,
});

function TeamPage() {
  const [memberships, setMemberships] = useState<OrganizationMembership[] | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [orgBusy, setOrgBusy] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const refreshOrgs = async () => {
    const orgs = await fetchMyOrganizations();
    setMemberships(orgs);
  };

  useEffect(() => {
    fetchMyOrganizations().then((orgs) => {
      setMemberships(orgs);
    });
  }, []);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setOrgBusy(true);
    try {
      const org = await createOrganization(newOrgName.trim());
      setNewOrgName("");
      await refreshOrgs();
      await setActiveOrganization(org.id);
      setActiveOrgId(org.id);
      toast.success(`Team "${org.name}" created`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create team");
    } finally {
      setOrgBusy(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!joinSlug.trim()) return;
    setOrgBusy(true);
    try {
      await joinOrganizationBySlug(joinSlug.trim());
      setJoinSlug("");
      await refreshOrgs();
      toast.success("Joined team");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to join team");
    } finally {
      setOrgBusy(false);
    }
  };

  const handleLeave = async (orgId: string) => {
    if (!confirm("Leave this team?")) return;
    try {
      await leaveOrganization(orgId);
      if (activeOrgId === orgId) {
        await setActiveOrganization(null);
        setActiveOrgId(null);
      }
      await refreshOrgs();
      toast.success("Left team");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to leave team");
    }
  };

  const handleSetActive = async (orgId: string) => {
    const next = activeOrgId === orgId ? null : orgId;
    try {
      await setActiveOrganization(next);
      setActiveOrgId(next);
      toast.success(next ? "Active team updated" : "Cleared active team");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const copySlug = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(slug);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/"><button className="p-2 rounded-xl glass hover:bg-primary/10 transition-colors"><ArrowLeft className="h-5 w-5" /></button></Link>
          <div>
            <p className="label-overline">Workspace</p>
            <h1 className="page-title mt-0.5">My <span className="gold-text">Teams</span></h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl">
          {/* Org list */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Your Teams</h2>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Share logs with hangar mates by switching a log's visibility to "Team". Set one team as active to filter your workspace.
            </p>

            {memberships === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : memberships.length === 0 ? (
              <div className="rounded-xl glass-subtle p-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">You're not in any teams yet.</p>
                <p className="text-[11px] text-muted-foreground mt-1">Create one below or join with a team ID.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-2">
                {memberships.map((m, i) => {
                  const isActive = activeOrgId === m.organization_id;
                  const slug = m.organizations?.slug ?? "";
                  const joinedAt = m.organizations?.created_at
                    ? new Date(m.organizations.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
                    : null;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl glass-subtle p-4"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {m.organizations?.name ?? "Team"}
                            </p>
                            {isActive && (
                              <span className="text-[9px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => copySlug(slug)}
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                          >
                            ID: {slug}
                            {copiedSlug === slug ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{m.role}</span>
                          {joinedAt && (
                            <span className="text-[10px] text-muted-foreground">Since {joinedAt}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={isActive ? "secondary" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSetActive(m.organization_id)}
                        >
                          {isActive ? "Active" : "Set active"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleLeave(m.organization_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Create team */}
          <Card className="p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Create a Team</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Start a new workspace for your hangar or organisation. Share the team ID with colleagues so they can join.
            </p>
            <div className="flex gap-2">
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g. Lagos Hangar 3"
                className="placeholder:normal-case"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateOrg(); }}
              />
              <Button
                variant="action"
                size="default"
                onClick={handleCreateOrg}
                disabled={orgBusy || !newOrgName.trim()}
              >
                {orgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </Card>

          {/* Join team */}
          <Card className="p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Join with Team ID</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Enter the slug shared by your team lead (e.g. <span className="font-mono text-foreground">lagos-hangar-3</span>).
            </p>
            <div className="flex gap-2">
              <Input
                value={joinSlug}
                onChange={(e) => setJoinSlug(e.target.value)}
                placeholder="e.g. lagos-hangar-3"
                className="placeholder:normal-case font-mono"
                onKeyDown={(e) => { if (e.key === "Enter") handleJoinOrg(); }}
              />
              <Button
                variant="action"
                size="default"
                onClick={handleJoinOrg}
                disabled={orgBusy || !joinSlug.trim()}
              >
                {orgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              </Button>
            </div>
          </Card>

          {/* Help card */}
          <Card className="p-5 border-primary/10">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">How Teams Work</h2>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc list-inside">
              <li>Create or join a team to share maintenance logs with colleagues.</li>
              <li>Set a team as <span className="font-semibold text-foreground">Active</span> to scope your workspace to that hangar.</li>
              <li>Share your <span className="font-mono text-foreground">team ID</span> (slug) for others to join.</li>
              <li>Per-log visibility still controls whether a log is shared with the team or kept private.</li>
            </ul>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

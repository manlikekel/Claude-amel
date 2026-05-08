import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Search as SearchIcon, Loader2, Globe, User, Sparkles, ThumbsUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { fetchLogs, ATA_CHAPTERS, type LogEntry } from "@/lib/data";
import { fetchCommunityCandidates, fetchVoteCounts, fetchMyVotes, toggleVote } from "@/lib/community-search";
import {
  rankResults,
  rankSuggestedFixes,
  type CommunityEntry,
  type ScopedResult,
  type SuggestedFix,
} from "@/lib/search-engine";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [{ title: "Fault Search – AMEL" }, { name: "description", content: "Search faults across your logs and the global engineer community." }],
  }),
  component: SearchPage,
});

type Scope = "all" | "mine" | "global";

function ataCodeOnly(s: string): string {
  const m = s.match(/\b(\d{2,3})\b/);
  return m ? m[1].padStart(2, "0") : "";
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const [ataFilter, setAtaFilter] = useState(""); // chapter string or ""
  const [scope, setScope] = useState<Scope>("all");

  const [allMyLogs, setAllMyLogs] = useState<LogEntry[]>([]);
  const [communityHits, setCommunityHits] = useState<CommunityEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());

  // Preload personal logs once
  useEffect(() => {
    fetchLogs().then(setAllMyLogs).catch(() => {});
  }, []);

  const aircraftOptions = useMemo(() => {
    const set = new Set(allMyLogs.map((l) => l.aircraft_model).filter(Boolean));
    return Array.from(set).sort();
  }, [allMyLogs]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setCommunityHits([]);
      setHasSearched(false);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      setHasSearched(true);
      try {
        if (scope !== "mine") {
          const community = await fetchCommunityCandidates({
            query,
            aircraftModel: aircraftFilter || undefined,
            ataChapter: ataFilter ? ataCodeOnly(ataFilter) : undefined,
          });
          setCommunityHits(community);
          const ids = community.map((c) => c.id);
          const [counts, voted] = await Promise.all([fetchVoteCounts(ids), fetchMyVotes(ids)]);
          setVoteCounts(counts);
          setMyVotes(voted);
        } else {
          setCommunityHits([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, aircraftFilter, ataFilter, scope]);

  const ataCode = ataFilter ? ataCodeOnly(ataFilter) : undefined;

  const scopedMyLogs: ScopedResult<LogEntry>[] = useMemo(() => {
    if (!query.trim() || scope === "global") return [];
    let pool = allMyLogs;
    if (aircraftFilter) pool = pool.filter((l) => l.aircraft_model.toLowerCase() === aircraftFilter.toLowerCase());
    if (ataCode) pool = pool.filter((l) => ataCodeOnly(l.ata_chapter) === ataCode);
    return rankResults(pool, { query, aircraftFilter, ataFilter: ataCode });
  }, [allMyLogs, query, aircraftFilter, ataCode, scope]);

  const scopedCommunity: ScopedResult<CommunityEntry>[] = useMemo(() => {
    if (!query.trim() || scope === "mine") return [];
    return rankResults(communityHits, { query, aircraftFilter, ataFilter: ataCode });
  }, [communityHits, query, aircraftFilter, ataCode, scope]);

  const suggestions: SuggestedFix[] = useMemo(() => {
    if (!query.trim()) return [];
    return rankSuggestedFixes({ scopedLogs: scopedMyLogs, scopedCommunity });
  }, [scopedMyLogs, scopedCommunity, query]);

  // Related ATA chapters from current results
  const relatedAta = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const c of scopedCommunity) {
      const code = c.ata_chapter?.match(/\d{1,2}/)?.[0];
      if (code && !seen.has(code)) { seen.add(code); chips.push(c.ata_chapter.split("–")[0].trim()); }
    }
    return chips.slice(0, 5);
  }, [scopedCommunity]);

  const handleVote = useCallback(async (faultId: string) => {
    const voted = myVotes.has(faultId);
    setMyVotes((prev) => {
      const next = new Set(prev);
      voted ? next.delete(faultId) : next.add(faultId);
      return next;
    });
    setVoteCounts((prev) => ({ ...prev, [faultId]: Math.max(0, (prev[faultId] || 0) + (voted ? -1 : 1)) }));
    try { await toggleVote(faultId, voted); } catch { /* revert on error */ }
  }, [myVotes]);

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-10 relative">
        <div className="mb-6">
          <p className="label-overline">Knowledge</p>
          <h1 className="page-title mt-1">Fault <span className="gold-text">Search</span></h1>
          <p className="page-subtitle">Your past fixes + global engineer knowledge</p>
        </div>

        <div className="relative mb-3">
          <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the fault… (e.g. pack high temp, low oil pressure)"
            className="h-12 pl-10 text-base placeholder:normal-case"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <select
            value={aircraftFilter}
            onChange={(e) => setAircraftFilter(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-[var(--glass-border)] bg-[oklch(1_0_0/0.03)] px-3 text-xs text-foreground backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">All aircraft models</option>
            {aircraftOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={ataFilter}
            onChange={(e) => setAtaFilter(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-[var(--glass-border)] bg-[oklch(1_0_0/0.03)] px-3 text-xs text-foreground backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">All ATA chapters</option>
            {ATA_CHAPTERS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="mb-6 flex gap-1.5">
          {(["all", "mine", "global"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              data-active={scope === s}
              className="seg-pill flex-1 press"
            >
              {s === "all" ? "All" : s === "mine" ? "My Logs" : "Global DB"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {hasSearched ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Suggested Fixes */}
              {suggestions.length > 0 && (
                <section>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Suggested Fixes
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((s) => (
                      <Card key={s.action} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground capitalize flex-1 min-w-0">🔧 {s.action}</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">
                                <ConfidenceBadge level={s.level} />
                                <Info className="h-3 w-3 text-muted-foreground/60" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
                              {s.level === "High" ? "Reported in 5+ cases across your logs and community data." :
                               s.level === "Medium" ? "Found in 2–4 cases. Confidence moderate." :
                               "Seen in 1 case. Treat as a starting point."}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Seen in {s.occurrences} {s.occurrences === 1 ? "case" : "cases"}
                        </p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* My Past Fixes */}
              {scope !== "global" && (
                <section>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <User className="h-3.5 w-3.5" /> My Past Fixes
                  </h2>
                  {scopedMyLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching personal logs.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {scopedMyLogs.slice(0, 10).map((log) => (
                        <Link key={log.id} to="/log" search={{ id: log.id }}>
                          <Card className="p-3 hover:border-primary/40 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-primary">{log.aircraft_model || log.registration || "Aircraft"}</p>
                              {log.ata_chapter && <span className="text-[10px] font-mono text-muted-foreground">{log.ata_chapter.split(" ")[0]}</span>}
                            </div>
                            <p className="text-sm text-foreground line-clamp-2">{log.fault_description}</p>
                            {log.action_taken && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">✓ {log.action_taken}</p>}
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Global community */}
              {scope !== "mine" && (
                <section>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Globe className="h-3.5 w-3.5" /> Global Community Results
                  </h2>
                  {scopedCommunity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No anonymized matches yet. Be the first to share a fix.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {scopedCommunity.slice(0, 12).map((c) => (
                        <Card key={c.id} className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-primary">{c.aircraft_model || "—"}</p>
                            <div className="flex items-center gap-2">
                              {c.ata_chapter && <span className="text-[10px] font-mono text-muted-foreground">{c.ata_chapter.split(" ")[0]}</span>}
                              {c.country_region && <span className="text-[10px] text-muted-foreground">{c.country_region}</span>}
                            </div>
                          </div>
                          <p className="text-sm text-foreground line-clamp-2">{c.fault_description}</p>
                          {c.action_taken && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">✓ {c.action_taken}</p>}
                          {c.maintenance_reference && <p className="mt-0.5 text-[10px] text-primary/80 font-mono">{c.maintenance_reference}</p>}
                          <button
                            onClick={() => handleVote(c.id)}
                            className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium transition-colors ${myVotes.has(c.id) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <ThumbsUp className={`h-3.5 w-3.5 ${myVotes.has(c.id) ? "fill-primary" : ""}`} />
                            {voteCounts[c.id] ? `${voteCounts[c.id]} helpful` : "Mark helpful"}
                          </button>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </motion.div>
          ) : (
            <div className="mt-12 flex flex-col items-center text-center">
              <SearchIcon className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Type a fault to search your logs and the global community.</p>
            </div>
          )}
        </AnimatePresence>

        {/* Related ATA chapters */}
        {relatedAta.length > 1 && (
          <div className="mt-6">
            <p className="label-overline mb-2">Related ATA Chapters</p>
            <div className="flex flex-wrap gap-2">
              {relatedAta.map((ata) => (
                <button
                  key={ata}
                  onClick={() => setAtaFilter(ata)}
                  className="ata-chip hover:border-primary/40 hover:text-primary transition-colors press"
                >
                  {ata}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}

function ConfidenceBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  const cls =
    level === "High" ? "bg-primary/20 text-primary border-primary/40"
    : level === "Medium" ? "bg-accent/30 text-foreground border-glass-border"
    : "glass-subtle text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {level}
    </span>
  );
}

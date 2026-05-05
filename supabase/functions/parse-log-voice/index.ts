// Voice → structured maintenance log parser.
// Takes a free-text transcript (already produced by transcribe-audio) and
// extracts the AMEL log fields the engineer would otherwise type by hand.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transcript, chapters } = await req.json();
    if (!transcript || typeof transcript !== "string") throw new Error("Missing transcript");
    if (!Array.isArray(chapters) || chapters.length === 0) throw new Error("Missing chapter list");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an aircraft maintenance log parser. Extract structured fields from a spoken maintenance note by an Aircraft Maintenance Engineer. " +
              "Be conservative — only fill a field when the transcript clearly states it. Leave fields empty otherwise. " +
              "Always return the exact ATA chapter STRING from the provided list (or empty string if unsure). " +
              "Use UPPERCASE for free-text fields. Aircraft model should match common designators (e.g. CRJ200, B737-800, A320, DHC-8). " +
              "Registration should be in standard format (e.g. 5N-XEL, G-ABCD, N123AB).",
          },
          {
            role: "user",
            content: `Transcript:\n"""${transcript}"""\n\nAvailable ATA chapters (use exactly one or empty):\n${chapters.join("\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_log_fields",
              description: "Extract maintenance log fields from a spoken note.",
              parameters: {
                type: "object",
                properties: {
                  registration: { type: "string", description: "Aircraft tail number, or empty." },
                  aircraft_model: { type: "string", description: "Aircraft model designator, or empty." },
                  manufacturer: { type: "string", description: "Aircraft manufacturer, or empty." },
                  ata_chapter: {
                    type: "string",
                    enum: ["", ...chapters],
                    description: "ATA chapter — must match list exactly or be empty.",
                  },
                  fault_description: { type: "string", description: "What happened / observed fault." },
                  action_taken: { type: "string", description: "What was done to address it." },
                  root_cause: { type: "string", description: "Root cause if mentioned." },
                  system_component: { type: "string", description: "System or component, e.g. PRSOV, ram air fan." },
                  maintenance_reference: { type: "string", description: "AMM/FIM/SRM reference, e.g. AMM 36-11-00." },
                  symptoms: {
                    type: "array",
                    items: { type: "string" },
                    description: "Short symptom tags (e.g. low pressure, EICAS message).",
                  },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: [
                  "registration", "aircraft_model", "manufacturer", "ata_chapter",
                  "fault_description", "action_taken", "root_cause",
                  "system_component", "maintenance_reference", "symptoms", "confidence",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_log_fields" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded — please wait a moment and retry." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Top up in Workspace Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const err = await response.text();
      console.error("AI gateway error", response.status, err);
      return new Response(JSON.stringify({ error: "Parse failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output returned");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-log-voice error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

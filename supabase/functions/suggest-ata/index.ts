import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fault, chapters } = await req.json();
    if (!fault || typeof fault !== "string") throw new Error("Missing fault text");
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
              "You are an aircraft maintenance ATA (Air Transport Association of America) chapter classifier. Given a fault description, pick the SINGLE best matching ATA chapter from the provided list. You MUST return one of the exact strings from the list — never invent one.",
          },
          {
            role: "user",
            content: `Fault description:\n"""${fault}"""\n\nAvailable ATA chapters (pick exactly one):\n${chapters.join(
              "\n"
            )}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_ata_chapter",
              description: "Select the most appropriate ATA chapter for the fault.",
              parameters: {
                type: "object",
                properties: {
                  chapter: { type: "string", enum: chapters },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  reasoning: { type: "string", description: "One short sentence explaining the choice." },
                },
                required: ["chapter", "confidence", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "select_ata_chapter" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded — please wait a moment and retry." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Top up in Workspace Usage." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const err = await response.text();
      console.error("AI gateway error", response.status, err);
      return new Response(JSON.stringify({ error: "ATA suggestion failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No suggestion returned");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-ata error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

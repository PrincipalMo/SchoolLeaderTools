import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Minimal iCal parser - handles VEVENT blocks
function parseICal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = text.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r\n|\n|\r/);

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (line === "END:VEVENT") {
      inEvent = false;
      if (current["DTSTART"] && current["SUMMARY"]) {
        events.push({
          uid: current["UID"] || crypto.randomUUID(),
          summary: unescape(current["SUMMARY"] || ""),
          dtstart: parseDate(current["DTSTART"] || current["DTSTART;VALUE=DATE"] || ""),
          dtend: parseDate(current["DTEND"] || current["DTEND;VALUE=DATE"] || ""),
          description: unescape(current["DESCRIPTION"] || ""),
          location: unescape(current["LOCATION"] || ""),
        });
      }
    } else if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        // Handle params like DTSTART;TZID=America/New_York:20260504T070000
        const keyPart = line.substring(0, colonIdx);
        const val = line.substring(colonIdx + 1);
        const semiIdx = keyPart.indexOf(";");
        const key = semiIdx > 0 ? keyPart.substring(0, semiIdx) : keyPart;
        current[key] = val;
      }
    }
  }

  return events;
}

interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: Date | null;
  dtend: Date | null;
  description: string;
  location: string;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  try {
    // Handle TZID format suffix after last colon
    const val = s.includes(":") ? s.split(":").pop()! : s;
    if (val.length === 8) {
      // DATE only: 20260504
      return new Date(
        `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}T00:00:00`
      );
    }
    // DATETIME: 20260504T070000Z or 20260504T070000
    const y = val.substring(0, 4);
    const mo = val.substring(4, 6);
    const d = val.substring(6, 8);
    const h = val.substring(9, 11);
    const mi = val.substring(11, 13);
    const se = val.substring(13, 15);
    const utc = val.endsWith("Z") ? "Z" : "";
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}${utc}`);
  } catch {
    return null;
  }
}

function unescape(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json() as { url: string };

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the iCal feed
    const res = await fetch(url, {
      headers: { "User-Agent": "WAG-Calendar/1.0" },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch calendar: ${res.status} ${res.statusText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = await res.text();
    const events = parseICal(text);

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

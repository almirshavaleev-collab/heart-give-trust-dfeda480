import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Standalone Resend integration.
 * Additive only: does not affect existing Lovable email infrastructure.
 *
 * POST { to, subject, html?, text? }
 * → { ok: true, id } | { ok: false, error }
 */

interface SendEmailBody {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");

  if (!apiKey) {
    console.error("[send-email-resend] RESEND_API_KEY missing");
    return json(500, { ok: false, error: "resend_api_key_missing" });
  }
  if (!from) {
    console.error("[send-email-resend] RESEND_FROM_EMAIL missing");
    return json(500, { ok: false, error: "resend_from_email_missing" });
  }

  let body: SendEmailBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const to = String(body?.to ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const html = body?.html;
  const text = body?.text;

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return json(400, { ok: false, error: "invalid_to" });
  }
  if (!subject) return json(400, { ok: false, error: "subject_required" });
  if (!html && !text) return json(400, { ok: false, error: "html_or_text_required" });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    const respText = await res.text();
    if (!res.ok) {
      console.error("[send-email-resend] resend_error", { status: res.status, body: respText });
      return json(502, { ok: false, error: "resend_error", status: res.status, response: respText });
    }

    let id: string | undefined;
    try {
      const parsed = JSON.parse(respText);
      id = parsed?.id;
    } catch {
      /* keep id undefined */
    }

    return json(200, { ok: true, id });
  } catch (err) {
    console.error("[send-email-resend] network_error", err);
    return json(500, { ok: false, error: "network_error", detail: String(err) });
  }
});
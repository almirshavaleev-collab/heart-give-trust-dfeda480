import { createClient } from "npm:@supabase/supabase-js@2";
import {
  renderAuthEmail,
  type AuthEmailType,
} from "../_shared/auth-email-templates/index.ts";

/**
 * Supabase Auth Send Email Hook → Resend.
 *
 * Standard Webhooks signature verification (HMAC SHA-256 with SEND_EMAIL_HOOK_SECRET).
 * Renders Russian-branded HTML/text and sends via Resend API.
 * Logs every attempt into public.auth_email_log.
 *
 * Additive: does not touch existing Lovable email infrastructure.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(
  rawBody: string,
  secretEnv: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
): Promise<boolean> {
  // Standard Webhooks: secret looks like "v1,whsec_<base64>" or "whsec_<base64>" or raw base64
  let secret = secretEnv.trim();
  if (secret.startsWith("v1,")) secret = secret.slice(3);
  if (secret.startsWith("whsec_")) secret = secret.slice(6);

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(secret);
  } catch {
    keyBytes = new TextEncoder().encode(secret);
  }

  // Timestamp tolerance: 5 minutes
  const tsNum = Number(webhookTimestamp);
  if (!Number.isFinite(tsNum)) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (skew > 60 * 5) return false;

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = bytesToBase64(sigBuf);

  // webhook-signature: space-separated list "v1,<sig> v1,<sig2>"
  const parts = webhookSignature.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const [, sig] = p.split(",", 2);
    if (sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}

interface AuthHookPayload {
  user: { id?: string; email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: AuthEmailType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildConfirmationUrl(payload: AuthHookPayload): string {
  const { token_hash, email_action_type, redirect_to, site_url } = payload.email_data;
  const params = new URLSearchParams({
    token: token_hash,
    type: email_action_type,
  });
  if (redirect_to) params.set("redirect_to", redirect_to);
  return `${site_url.replace(/\/$/, "")}/auth/v1/verify?${params.toString()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");
  const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error("[auth-email-resend] resend env missing");
    return json(500, { ok: false, error: "resend_env_missing" });
  }
  if (!HOOK_SECRET) {
    console.error("[auth-email-resend] SEND_EMAIL_HOOK_SECRET missing");
    return json(500, { ok: false, error: "hook_secret_missing" });
  }

  const rawBody = await req.text();
  const webhookId = req.headers.get("webhook-id") ?? "";
  const webhookTimestamp = req.headers.get("webhook-timestamp") ?? "";
  const webhookSignature = req.headers.get("webhook-signature") ?? "";

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.error("[auth-email-resend] missing webhook headers");
    await admin.from("auth_email_log").insert({
      email: "unknown",
      email_action_type: "unknown",
      status: "invalid_signature",
      error: "missing_webhook_headers",
    });
    return json(401, { ok: false, error: "missing_webhook_headers" });
  }

  const ok = await verifySignature(
    rawBody,
    HOOK_SECRET,
    webhookId,
    webhookTimestamp,
    webhookSignature,
  );
  if (!ok) {
    console.error("[auth-email-resend] invalid signature");
    await admin.from("auth_email_log").insert({
      email: "unknown",
      email_action_type: "unknown",
      status: "invalid_signature",
      error: "hmac_mismatch",
    });
    return json(401, { ok: false, error: "invalid_signature" });
  }

  let payload: AuthHookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const email = payload.user?.email;
  const userId = payload.user?.id ?? null;
  const actionType = payload.email_data?.email_action_type;
  const tokenHash = payload.email_data?.token_hash ?? null;

  if (!email || !actionType || !payload.email_data?.site_url) {
    return json(400, { ok: false, error: "invalid_payload" });
  }

  // Idempotency: skip if same (action, token_hash) already sent in last 30s
  if (tokenHash) {
    const since = new Date(Date.now() - 30_000).toISOString();
    const { data: dup } = await admin
      .from("auth_email_log")
      .select("id")
      .eq("email_action_type", actionType)
      .eq("token_hash", tokenHash)
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (dup) {
      await admin.from("auth_email_log").insert({
        user_id: userId,
        email,
        email_action_type: actionType,
        status: "skipped_duplicate",
        token_hash: tokenHash,
      });
      return json(200, { ok: true, skipped: "duplicate" });
    }
  }

  const confirmationUrl = buildConfirmationUrl(payload);
  const rendered = renderAuthEmail(actionType, {
    email,
    newEmail: payload.user?.new_email,
    confirmationUrl,
    token: payload.email_data.token,
    siteUrl: payload.email_data.site_url,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    const respText = await res.text();

    if (!res.ok) {
      console.error("[auth-email-resend] resend_error", res.status, respText);
      await admin.from("auth_email_log").insert({
        user_id: userId,
        email,
        email_action_type: actionType,
        status: "failed",
        error: `resend_${res.status}: ${respText.slice(0, 500)}`,
        token_hash: tokenHash,
      });
      return json(502, { ok: false, error: "resend_error", status: res.status });
    }

    let resendId: string | null = null;
    try {
      resendId = JSON.parse(respText)?.id ?? null;
    } catch {
      /* ignore */
    }

    await admin.from("auth_email_log").insert({
      user_id: userId,
      email,
      email_action_type: actionType,
      status: "sent",
      resend_id: resendId,
      token_hash: tokenHash,
    });

    console.log("[auth-email-resend] sent", { actionType, email, resendId });
    return json(200, { ok: true, id: resendId });
  } catch (err) {
    const detail = String(err);
    console.error("[auth-email-resend] network_error", detail);
    await admin.from("auth_email_log").insert({
      user_id: userId,
      email,
      email_action_type: actionType,
      status: "failed",
      error: `network_error: ${detail.slice(0, 500)}`,
      token_hash: tokenHash,
    });
    return json(500, { ok: false, error: "network_error" });
  }
});
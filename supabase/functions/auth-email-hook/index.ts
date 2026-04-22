import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import {
  buildEmailDebugPayload,
  buildOutboundDiff,
  buildRenderDiagnostics,
  inspectString,
  type OutboundEmailSnapshot,
} from '../_shared/email-debug.ts'
import { recoveryDiagnosticsScenarios } from '../_shared/recovery-render-debug.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const AUTH_TEMPLATE_VERSION = 'AUTH_EMAIL_PIPELINE_V2_2026_04_22'

// In-memory ring buffer for the most recent outbound payloads enqueued by this
// edge function instance. Used by /diff-outbound to compare what was actually
// sent to the email provider against a freshly rendered template.
const OUTBOUND_SNAPSHOTS_LIMIT = 8
const outboundSnapshots: OutboundEmailSnapshot[] = []

const recordOutboundSnapshot = (snapshot: OutboundEmailSnapshot) => {
  outboundSnapshots.unshift(snapshot)
  if (outboundSnapshots.length > OUTBOUND_SNAPSHOTS_LIMIT) {
    outboundSnapshots.length = OUTBOUND_SNAPSHOTS_LIMIT
  }
}

const findOutboundSnapshot = (emailType: string, runId?: string) => {
  if (runId) {
    const exact = outboundSnapshots.find((snap) => snap.runId === runId)
    if (exact) return exact
  }
  return outboundSnapshots.find((snap) => snap.emailType === emailType) ?? null
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'SIGNUP TEMPLATE V2 · Подтвердите email — Фонд «Лига»',
  invite: 'Приглашение в личный кабинет — Фонд «Лига»',
  magiclink: 'Ссылка для входа — Фонд «Лига»',
  recovery: 'RECOVERY TEMPLATE V2 · Восстановление пароля — Фонд «Лига»',
  email_change: 'Подтверждение смены email — Фонд «Лига»',
  reauthentication: 'Код подтверждения — Фонд «Лига»',
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
import { BRAND_NAME } from '../_shared/brand.ts'
const SITE_NAME = BRAND_NAME
const SENDER_DOMAIN = "notify.ligafund.ru"
const ROOT_DOMAIN = "ligafund.ru"
const FROM_DOMAIN = "notify.ligafund.ru" // Domain shown in From address (may be root or sender subdomain)

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://heart-give-trust.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

const buildTemplateProps = (data: Record<string, any>) => ({
  siteName: SITE_NAME,
  siteUrl: `https://${ROOT_DOMAIN}`,
  recipient: data.email,
  confirmationUrl: data.url,
  token: data.token,
  email: data.email,
  newEmail: data.new_email,
})

async function renderEmailContent(emailType: string, templateProps: Record<string, any>) {
  const EmailTemplate = EMAIL_TEMPLATES[emailType]

  if (!EmailTemplate) {
    throw new Error(`Unknown email type: ${emailType}`)
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })
  const subject = EMAIL_SUBJECTS[emailType] || 'Notification'

  return { EmailTemplate, html, text, subject }
}

const isRecoveryEmail = (emailType: string) => emailType === 'recovery'

const logEmailDebug = ({ emailType, subject, siteName, html, text }: {
  emailType: string
  subject: string
  siteName?: string
  html: string
  text: string
}) => {
  if (!isRecoveryEmail(emailType)) return

  console.log('Auth email debug', {
    templateVersion: AUTH_TEMPLATE_VERSION,
    ...buildEmailDebugPayload({
      emailType,
      subject,
      siteName,
      brandName: BRAND_NAME,
      html,
      text,
    }),
  })
}

async function handleDebugPreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  let templateData: Record<string, any> | undefined
  try {
    const body = await req.json()
    type = body.type
    templateData = body.templateData
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const sampleData = SAMPLE_DATA[type] || {}
    const data = { ...sampleData, ...templateData }
    const templateProps = type === 'recovery'
      ? {
          siteName: SITE_NAME,
          confirmationUrl: data.confirmationUrl ?? SAMPLE_PROJECT_URL,
        }
      : buildTemplateProps(data)
    const { html, text, subject } = await renderEmailContent(type, templateProps)

    return new Response(JSON.stringify({
      templateVersion: AUTH_TEMPLATE_VERSION,
      sender: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      ...buildEmailDebugPayload({
        emailType: type,
        subject,
        siteName: SITE_NAME,
        brandName: BRAND_NAME,
        html,
        text,
      }),
    }), {
      status: 200,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
}

async function handleRecoveryRenderDebug(req: Request): Promise<Response> {
  const debugCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: debugCorsHeaders })
  }

  const results = []

  for (const scenario of recoveryDiagnosticsScenarios) {
    const html = await renderAsync(scenario.node())
    const text = await renderAsync(scenario.node(), { plainText: true })

    results.push({
      id: scenario.id,
      ...buildRenderDiagnostics({
        label: scenario.label,
        jsx: scenario.jsx,
        expected: scenario.expected,
        html,
        text,
      }),
    })
  }

  const firstBrokenScenario = results.find((scenario) => scenario.hasReplacementCharacter.html || scenario.hasReplacementCharacter.text)

  console.log('Recovery render diagnostics', {
    brandName: inspectString(BRAND_NAME),
    firstBrokenScenario,
    results,
  })

  return new Response(JSON.stringify({
    brandName: inspectString(BRAND_NAME),
    firstBrokenScenario,
    results,
  }), {
    status: 200,
    headers: { ...debugCorsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!EMAIL_TEMPLATES[type]) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const templateProps = type === 'recovery'
    ? {
        siteName: SITE_NAME,
        confirmationUrl: (sampleData as Record<string, any>).confirmationUrl ?? SAMPLE_PROJECT_URL,
      }
    : buildTemplateProps(sampleData as Record<string, any>)
  const { html } = await renderEmailContent(type, templateProps)

  return new Response(html, {
    status: 200,
    headers: {
      ...previewCorsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'X-Auth-Template-Version': AUTH_TEMPLATE_VERSION,
    },
  })
}

// Webhook handler - verifies signature and sends email
async function handleWebhook(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify signature + timestamp, then parse payload.
  let payload: any
  let run_id = ''
  try {
    const verified = await verifyWebhookRequest({
      req,
      secret: apiKey,
      parser: parseEmailWebhookPayload,
    })
    payload = verified.payload
    run_id = payload.run_id
  } catch (error) {
    if (error instanceof WebhookError) {
      switch (error.code) {
        case 'invalid_signature':
        case 'missing_timestamp':
        case 'invalid_timestamp':
        case 'stale_timestamp':
          console.error('Invalid webhook signature', { error: error.message })
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        case 'invalid_payload':
        case 'invalid_json':
          console.error('Invalid webhook payload', { error: error.message })
          return new Response(
            JSON.stringify({ error: 'Invalid webhook payload' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
      }
    }

    console.error('Webhook verification failed', { error })
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!run_id) {
    console.error('Webhook payload missing run_id')
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (payload.version !== '1') {
    console.error('Unsupported payload version', { version: payload.version, run_id })
    return new Response(
      JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // The email action type is in payload.data.action_type (e.g., "signup", "recovery")
  // payload.type is the hook event type ("auth")
  const emailType = payload.data.action_type
  console.log('Received auth event', { emailType, email: payload.data.email, run_id })

  if (!EMAIL_TEMPLATES[emailType]) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Build template props from payload.data (HookData structure)
  const templateProps = buildTemplateProps(payload.data)

  // Render React Email to HTML and plain text
  const { html, text, subject } = await renderEmailContent(emailType, templateProps)
  logEmailDebug({ emailType, subject, siteName: SITE_NAME, html, text })

  // Enqueue email for async processing by the dispatcher (process-email-queue).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: payload.data.email,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      run_id,
      message_id: messageId,
      to: payload.data.email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: payload.data.email,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: payload.data.email, run_id, templateVersion: AUTH_TEMPLATE_VERSION })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  if (url.pathname.endsWith('/debug-preview')) {
    return handleDebugPreview(req)
  }

  if (url.pathname.endsWith('/debug-recovery-render')) {
    return handleRecoveryRenderDebug(req)
  }

  // Main webhook handler
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Identify the caller using their JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return json({ error: 'unauthorized' }, 401)
  }
  const user = userData.user
  if (!user.email) {
    return json({ error: 'no_email' }, 400)
  }

  // Use the user's JWT to call the RPC so auth.uid() matches inside SECURITY DEFINER fn
  const { data: code, error: rpcError } = await userClient.rpc(
    'request_link_donations_code',
    { _user_id: user.id }
  )

  if (rpcError) {
    const msg = rpcError.message || ''
    if (msg.includes('rate_limited')) return json({ error: 'rate_limited' }, 429)
    if (msg.includes('no_email')) return json({ error: 'no_email' }, 400)
    if (msg.includes('forbidden')) return json({ error: 'forbidden' }, 403)
    console.error('rpc error', rpcError)
    return json({ error: 'internal_error' }, 500)
  }

  // Fetch profile for personalised greeting (best effort)
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const firstName =
    (profile?.full_name || profile?.display_name || '').split(' ')[0] || null

  // Send via direct fetch with explicit service-role Authorization header
  // to avoid any JWT propagation issues from supabase-js functions.invoke.
  const sendRes = await fetch(
    `${supabaseUrl}/functions/v1/send-transactional-email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        templateName: 'donation-link-code',
        recipientEmail: user.email,
        idempotencyKey: `donation-link-${user.id}-${Date.now()}`,
        templateData: { code, name: firstName },
      }),
    },
  )

  if (!sendRes.ok) {
    const txt = await sendRes.text().catch(() => '')
    console.error('send error', sendRes.status, txt)
    return json({ error: 'email_send_failed' }, 502)
  }

  return json({ success: true })
})
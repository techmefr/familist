const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
Deno.serve(req => {
 if (req.method === 'OPTIONS') return new Response(null, { headers });
 if (req.method !== 'POST') return new Response(null, { status: 405, headers });
 const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
 const configured = publicKey && Deno.env.get('VAPID_PRIVATE_KEY') && Deno.env.get('VAPID_SUBJECT');
 return configured ? Response.json({ publicKey }, { headers }) : Response.json({ error: 'Web Push is not configured on this instance.' }, { status: 503, headers });
});

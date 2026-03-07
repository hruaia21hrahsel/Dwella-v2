Deno.serve(async (req) => {
  const { messages } = await req.json();
  const payload = messages.map((m: any) => ({
    to: m.token,
    title: m.title,
    body: m.body,
    data: m.data ?? {},
    sound: 'default',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
});

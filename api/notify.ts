// Avisos del @Secretario por Telegram.
// La app llama a esta función cuando ocurre algo (acciones de agentes, recordatorios...).
// El token y el chat de destino viven solo en Vercel: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.

const TIPOS: Record<string, string> = {
  accion: '⚡ Novedad',
  recordatorio: '⏰ Recordatorio',
  lead: '📥 Nuevo lead',
  prueba: '✅ Prueba'
};

// Límite simple por instancia para evitar spam (máx. 30 avisos por minuto)
let windowStart = 0;
let sentInWindow = 0;

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: 'Telegram no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)' };
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900), parse_mode: 'HTML', disable_web_page_preview: true })
  });
  const data: any = await r.json().catch(() => ({}));
  return data?.ok ? { ok: true } : { ok: false, error: data?.description || `Telegram respondió ${r.status}` };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const tipo = String(body.tipo || 'accion');
  const texto = String(body.texto || '').trim().slice(0, 1500);
  const agente = body.agente ? String(body.agente).slice(0, 60) : '';
  if (!TIPOS[tipo] || !texto) return res.status(400).json({ error: 'Aviso inválido' });

  const now = Date.now();
  if (now - windowStart > 60000) { windowStart = now; sentInWindow = 0; }
  if (++sentInWindow > 30) return res.status(429).json({ error: 'Demasiados avisos, espera un minuto' });

  const header = `<b>${TIPOS[tipo]}</b>${agente ? ` · @${escapeHtml(agente)}` : ''}`;
  const out = await sendTelegram(`🗂 <b>Secretario TJ FitLab</b>\n${header}\n\n${escapeHtml(texto)}`);
  return out.ok ? res.status(200).json({ ok: true }) : res.status(503).json({ error: out.error });
}

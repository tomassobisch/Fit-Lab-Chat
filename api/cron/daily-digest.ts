import { createClient } from '@supabase/supabase-js';

// Resumen diario del @Secretario por Telegram (Vercel Cron, ver vercel.json).
// Lee lo ocurrido en las últimas 24 h en Supabase, lo resume con Gemini y lo envía.

export const config = { maxDuration: 60 };

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];
const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function summarize(apiKey: string, prompt: string): Promise<string> {
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      });
      if (r.ok) {
        const d: any = await r.json();
        const text = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
        if (text) return text;
      } else if (![404, 429, 500, 503].includes(r.status)) break;
    } catch { /* probar el siguiente modelo */ }
  }
  return '';
}

async function sendTelegram(html: string) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: html.slice(0, 3900), parse_mode: 'HTML', disable_web_page_preview: true })
  });
  return (await r.json().catch(() => ({})))?.ok === true;
}

export default async function handler(req: any, res: any) {
  // Vercel Cron envía "Authorization: Bearer <CRON_SECRET>" si la variable existe
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers?.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'No autorizado' });
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return res.status(503).json({ error: 'Telegram no configurado' });

  const supabase = createClient(
    (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)!,
    (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [agentsR, msgsR, postsR, leadsR] = await Promise.all([
    supabase.from('tj_agentes').select('id,nickname'),
    supabase.from('tj_mensajes').select('canal,remitente_tipo,remitente_id,texto,creado_en').gte('creado_en', since).order('creado_en', { ascending: true }).limit(250),
    supabase.from('tj_foro_posts').select('titulo,autor_nombre,creado_en').gte('creado_en', since).order('creado_en', { ascending: true }),
    supabase.from('ig_leads').select('instagram_id,username,status,modalidad_interes,created_at,updated_at').gte('updated_at', since)
  ]);

  const nick = new Map((agentsR.data || []).map((a: any) => [a.id, a.nickname]));
  const msgs = msgsR.data || [];
  const posts = postsR.data || [];
  const leads = leadsR.data || [];
  const newLeads = leads.filter((l: any) => l.created_at >= since);

  const header = `☀️ <b>Resumen diario · Secretario TJ FitLab</b>\n${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })}\n\n` +
    `💬 ${msgs.length} mensajes · 📈 ${posts.length} posts en el foro · 📥 ${newLeads.length} leads nuevos de Instagram\n`;

  if (!msgs.length && !posts.length && !leads.length) {
    await sendTelegram(`${header}\nHoy ha sido un día tranquilo: no hubo actividad en las últimas 24 h.`);
    return res.status(200).json({ ok: true, empty: true });
  }

  const corpus = [
    'MENSAJES (más antiguos primero):',
    ...msgs.map((m: any) => `- [${m.canal}] ${m.remitente_tipo === 'agente' ? '@' + (nick.get(m.remitente_id) || 'agente') : m.canal === '#instagram' ? 'Lead IG' : 'Jefe'}: ${String(m.texto).replace(/\s+/g, ' ').slice(0, 400)}`),
    '', 'POSTS DEL FORO:', ...posts.map((p: any) => `- "${p.titulo}" por ${p.autor_nombre}`),
    '', 'LEADS DE INSTAGRAM (actualizados en 24 h):', ...leads.map((l: any) => `- ${l.username || l.instagram_id}: estado ${l.status || '-'}, interés ${l.modalidad_interes || '-'}${l.created_at >= since ? ' (NUEVO)' : ''}`)
  ].join('\n').slice(0, 30000);

  let resumen = '';
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    resumen = await summarize(geminiKey, `Eres @Secretario, el Chief of Staff de TJ FitLab. Escribe en español el resumen diario para el jefe a partir de la actividad de las últimas 24 h.
Formato: texto plano para Telegram (sin Markdown ni asteriscos), máximo 15 líneas, con viñetas "•". Secciones breves: lo más importante, lo que hicieron los agentes (tareas, publicaciones, leads), leads de Instagram y 1-3 próximos pasos recomendados. No inventes nada que no esté en los datos.

${corpus}`);
  }
  if (!resumen) {
    resumen = [
      ...posts.slice(0, 5).map((p: any) => `• Foro: "${p.titulo}"`),
      ...newLeads.slice(0, 5).map((l: any) => `• Nuevo lead IG: ${l.username || l.instagram_id}`),
      ...msgs.filter((m: any) => m.remitente_tipo === 'agente').slice(-5).map((m: any) => `• @${nick.get(m.remitente_id) || 'agente'}: ${String(m.texto).replace(/\s+/g, ' ').slice(0, 120)}`)
    ].join('\n');
  }

  const ok = await sendTelegram(`${header}\n${escapeHtml(resumen)}`);
  return res.status(ok ? 200 : 502).json({ ok });
}

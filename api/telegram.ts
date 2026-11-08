import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// El @Secretario responde en Telegram (webhook del bot).
// - "novedades", "resumen" o /resumen -> envía el resumen de las últimas 24 h
// - cualquier otra cosa -> responde con IA (Gemini + búsqueda gratuita vía /api/ai)
//   usando como contexto la actividad reciente de la oficina.
// Solo atiende al chat TELEGRAM_CHAT_ID. El secreto del webhook se deriva del token.

export const config = { maxDuration: 120 };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const webhookSecret = (token: string) => createHash('sha256').update('tjfitlab-telegram:' + token).digest('hex').slice(0, 48);

async function tg(method: string, payload: any) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return r.json().catch(() => ({}));
}
const reply = (chatId: string | number, text: string) =>
  tg('sendMessage', { chat_id: chatId, text: text.slice(0, 3900), parse_mode: 'HTML', disable_web_page_preview: true });

const handled = new Set<number>(); // evita procesar dos veces el mismo update si Telegram reintenta

// --- Publicación en Instagram (Graph API) ---
const IG_API = 'https://graph.facebook.com/v21.0';
async function igCall(path: string, params: Record<string, string>, method: 'POST' | 'GET' = 'POST') {
  const token = process.env.IG_ACCESS_TOKEN || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '';
  const qs = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(method === 'GET' ? `${IG_API}/${path}?${qs}` : `${IG_API}/${path}`, method === 'GET' ? {} : { method: 'POST', body: qs });
  const data: any = await r.json().catch(() => ({}));
  if (data?.error) throw new Error(data.error.error_user_msg || data.error.message || 'Error de Instagram');
  return data;
}
async function waitReady(id: string) {
  for (let i = 0; i < 15; i++) {
    const st = await igCall(id, { fields: 'status_code' }, 'GET');
    if (st.status_code === 'FINISHED') return;
    if (st.status_code === 'ERROR') throw new Error('Instagram no pudo procesar la imagen');
    await new Promise(r => setTimeout(r, 2000));
  }
}
async function publishToInstagram(formato: string, urls: string[], caption: string): Promise<string> {
  const ig = process.env.IG_ACCOUNT_ID || '17841431806225602';
  let creation: string;
  if (formato === 'carrusel' && urls.length > 1) {
    const children: string[] = [];
    for (const u of urls) children.push((await igCall(`${ig}/media`, { image_url: u, is_carousel_item: 'true' })).id);
    for (const c of children) await waitReady(c);
    creation = (await igCall(`${ig}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption })).id;
  } else if (formato === 'story') {
    creation = (await igCall(`${ig}/media`, { image_url: urls[0], media_type: 'STORIES' })).id;
  } else {
    creation = (await igCall(`${ig}/media`, { image_url: urls[0], caption })).id;
  }
  await waitReady(creation);
  const published = await igCall(`${ig}/media_publish`, { creation_id: creation });
  try { return (await igCall(published.id, { fields: 'permalink' }, 'GET')).permalink || ''; } catch { return ''; }
}

export default async function handler(req: any, res: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerChat = process.env.TELEGRAM_CHAT_ID;
  if (req.method !== 'POST') return res.status(200).json({ ok: true, configured: !!(token && ownerChat) });
  if (!token || !ownerChat) return res.status(503).json({ error: 'Telegram no configurado' });
  if (req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret(token)) return res.status(401).json({ error: 'No autorizado' });

  const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  if (update.callback_query) {
    const cq = update.callback_query;
    const m = cq.message;
    if (String(m?.chat?.id) !== String(ownerChat)) { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'No autorizado' }); return res.status(200).json({ ok: true }); }
    if (handled.has(update.update_id)) return res.status(200).json({ ok: true, duplicate: true });
    handled.add(update.update_id);
    const link = (m.entities || []).find((e: any) => e.type === 'text_link' && /\/api\/render\?d=/.test(e.url))?.url as string | undefined;
    const fullText: string = m.text || '';
    const caption = fullText.includes('\n\n') ? fullText.slice(fullText.indexOf('\n\n') + 2).replace(/\n\n🔗 Diseño\s*$/, '').trim() : '';
    if (cq.data === 'del') {
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Borrador descartado' });
      await tg('editMessageReplyMarkup', { chat_id: m.chat.id, message_id: m.message_id, reply_markup: { inline_keyboard: [] } });
      await reply(m.chat.id, '🗑 Borrador descartado.');
      return res.status(200).json({ ok: true });
    }
    if (cq.data === 'pub' && link) {
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Publicando en Instagram…' });
      await tg('editMessageReplyMarkup', { chat_id: m.chat.id, message_id: m.message_id, reply_markup: { inline_keyboard: [] } });
      try {
        const u = new URL(link);
        const d = u.searchParams.get('d') || '';
        const spec = JSON.parse(Buffer.from(d, 'base64url').toString('utf8'));
        const urls = (spec.s || []).map((_: any, i: number) => `${u.origin}/api/render?d=${d}&i=${i}`);
        const permalink = await publishToInstagram(spec.f, urls, caption);
        await reply(m.chat.id, `✅ <b>¡Publicado en Instagram!</b>${permalink ? `\n${permalink}` : ''}`);
      } catch (e: any) {
        const hint = /permission|permis|not authorized|access/i.test(e?.message || '') ? '\n\nPosible causa: tu Instagram no está vinculado a la página de Facebook, o el token no tiene el permiso de publicar.' : '';
        await reply(m.chat.id, `⚠️ No se pudo publicar: ${esc(e?.message || 'error')}${hint}\n\nEl borrador sigue aquí arriba; cuando esté resuelto, pídeme que lo vuelva a preparar.`);
      }
      return res.status(200).json({ ok: true });
    }
    await tg('answerCallbackQuery', { callback_query_id: cq.id });
    return res.status(200).json({ ok: true });
  }

  const msg = update.message || update.edited_message;
  const text: string = (msg?.text || '').trim();
  if (!msg || !text) return res.status(200).json({ ok: true });
  if (handled.has(update.update_id)) return res.status(200).json({ ok: true, duplicate: true });
  handled.add(update.update_id);
  if (handled.size > 200) handled.clear();

  const chatId = msg.chat?.id;
  if (String(chatId) !== String(ownerChat)) {
    await reply(chatId, 'Lo siento, solo atiendo al jefe de TJ FitLab. 🔒');
    return res.status(200).json({ ok: true });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const base = `https://${host}`;

  // /start
  if (/^\/start/i.test(text)) {
    await reply(chatId, '🗂 <b>Secretario TJ FitLab</b>\n\n¡Hola jefe! Estoy aquí. Pídeme <b>novedades</b> o un <b>resumen</b>, o pregúntame lo que necesites: puedo consultar lo que hicieron los agentes y buscar en internet.');
    return res.status(200).json({ ok: true });
  }

  // Resumen bajo demanda
  if (/^\/(resumen|novedades)|novedad|resumen|qu[eé] (hay|pas[oó]|tienes)/i.test(text)) {
    await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
    const r = await fetch(`${base}/api/cron/daily-digest`, {
      headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {}
    }).catch(() => null);
    if (!r || !r.ok) await reply(chatId, '⚠️ No pude preparar el resumen ahora mismo. Inténtalo en unos minutos.');
    return res.status(200).json({ ok: true });
  }

  // Pregunta libre: contexto de la oficina + IA
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  let contexto = '';
  try {
    const supabase = createClient(
      (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)!,
      (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
    );
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const [agentsR, msgsR, postsR] = await Promise.all([
      supabase.from('tj_agentes').select('id,nickname,rol'),
      supabase.from('tj_mensajes').select('remitente_tipo,remitente_id,texto,canal,creado_en').gte('creado_en', since).order('creado_en', { ascending: false }).limit(60),
      supabase.from('tj_foro_posts').select('titulo,autor_nombre,creado_en').gte('creado_en', since).order('creado_en', { ascending: false }).limit(10)
    ]);
    const nick = new Map((agentsR.data || []).map((a: any) => [a.id, a.nickname]));
    contexto = [
      'EQUIPO: ' + (agentsR.data || []).map((a: any) => `@${a.nickname} (${a.rol})`).join(', '),
      'ACTIVIDAD RECIENTE (48 h, más reciente primero):',
      ...(msgsR.data || []).map((m: any) => `- ${m.remitente_tipo === 'agente' ? '@' + (nick.get(m.remitente_id) || 'agente') : m.canal === '#telegram' ? 'Jefe (Telegram)' : 'Jefe'}: ${String(m.texto).replace(/\s+/g, ' ').slice(0, 300)}`),
      'FORO: ' + ((postsR.data || []).map((p: any) => `"${p.titulo}"`).join('; ') || 'sin posts')
    ].join('\n').slice(0, 14000);

    // Guardar la conversación en el chat de la oficina
    await supabase.from('tj_mensajes').insert({ canal: '#telegram', remitente_tipo: 'usuario', remitente_id: '00000000-0000-0000-0000-000000000000', texto: text, estado_procesado: true });
  } catch { /* sin contexto: responde igualmente */ }

  const prompt = `Eres @Secretario (Alex), Chief of Staff de TJ FitLab, y hablas con el jefe por Telegram.
Responde en español, breve y claro (máximo 12 líneas), en texto plano sin Markdown ni asteriscos.
Usa el CONTEXTO de la oficina cuando pregunte por el equipo o lo que se ha hecho. Si necesita datos actuales de internet, búscalos.
No inventes nada. Si te pide un post, carrusel o story de Instagram, prepáralo con la herramienta crear_post_instagram (le llegará aquí para aprobarlo). Para otras acciones (crear tareas, añadir leads) explícale que lo haga desde la app o la Oficina 3D.

CONTEXTO:
${contexto || '(no disponible)'}

MENSAJE DEL JEFE: ${text}`;

  let answer = '';
  try {
    const r = await fetch(`${base}/api/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, webSearch: true, actions: 'posts', agente: 'Secretario' })
    });
    const data: any = await r.json().catch(() => ({}));
    answer = data?.text || '';
    if (!answer && data?.error) answer = `⚠️ ${data.error}`;
  } catch (e: any) {
    answer = `⚠️ No pude consultar la IA: ${e?.message || 'error de conexión'}`;
  }
  answer = answer.replace(/\*\*/g, '').trim() || '⚠️ No obtuve respuesta, inténtalo de nuevo.';

  await reply(chatId, `🗂 <b>Secretario</b>\n\n${esc(answer)}`);
  try {
    const supabase = createClient((process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)!, (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!);
    const { data: sec } = await supabase.from('tj_agentes').select('id').ilike('nickname', 'secretario').maybeSingle();
    if (sec?.id) await supabase.from('tj_mensajes').insert({ canal: '#telegram', remitente_tipo: 'agente', remitente_id: sec.id, texto: answer, estado_procesado: true });
  } catch { /* no crítico */ }
  return res.status(200).json({ ok: true });
}

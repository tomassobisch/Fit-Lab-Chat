import Anthropic from '@anthropic-ai/sdk';

// Motor de los agentes de TJ FitLab: búsqueda en internet + herramientas de acción.
// Motor por defecto: GEMINI (gratis en su nivel free):
//   1) Gemini + Google Search investiga y redacta la respuesta.
//   2) Gemini con function calling decide y registra las acciones.
// Motor opcional: CLAUDE (web_search + herramientas), solo si AI_ENGINE=claude.
// Las acciones (foro, tareas, CRM...) se devuelven a la app, que es quien las aplica.
// Las claves (GEMINI_API_KEY / ANTHROPIC_API_KEY) viven en Vercel, no en el navegador.

// El cliente de Claude se crea solo si se usa ese motor (lee ANTHROPIC_API_KEY)

const MODEL = 'claude-opus-5-5';
// Modelos actuales (2.0/2.5 ya no están disponibles para cuentas nuevas). Se prueban en orden.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_ITERATIONS = 6;

// Tiempo máximo de la función en Vercel (Gemini puede encadenar varios modelos si hay saturación)
export const config = { maxDuration: 120 };

const SYSTEM = `Eres un agente del equipo de TJ FitLab (ecosistema de entrenamiento híbrido: fuerza + running, app para coaches y alumnos).
Trabajas para "el jefe" (Tomás). Respondes siempre en español.

Cuando el jefe te pida HACER algo, hazlo con tus herramientas en lugar de describir lo que harías:
- Buscar información actual, perfiles, estudios o estadísticas -> web_search. Cita las fuentes reales que encuentres; nunca inventes cifras ni URLs.
- Publicar un análisis o investigación -> publicar_en_foro.
- Encargar trabajo o planificar -> crear_tarea (con checklist si hay pasos).
- Recordatorios o mensajes a una hora concreta -> programar_mensaje.
- Un posible cliente para TJ FitLab -> agregar_lead_crm.
- Coaches/entrenadores reales encontrados en la web como prospectos B2B -> agregar_prospecto_coach (solo perfiles que hayas verificado con web_search).
No uses las etiquetas [PUBLISH_TITLE]/[PUBLISH_CONTENT]: usa la herramienta publicar_en_foro.
Si una petición es solo una pregunta, responde sin usar herramientas de acción.
Al terminar, resume en pocas líneas qué hiciste.`;

const ACTION_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'publicar_en_foro',
    description: 'Publica un artículo en el foro del equipo de TJ FitLab. Usar para investigaciones, análisis de tendencias o propuestas. El contenido va en Markdown, con fuentes reales enlazadas.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título del artículo' },
        contenido: { type: 'string', description: 'Cuerpo completo en Markdown' }
      },
      required: ['titulo', 'contenido'],
      additionalProperties: false
    }
  },
  {
    name: 'crear_tarea',
    description: 'Crea una tarea en el Planificador de TJ FitLab, asignada a un agente o a todos.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        agente_nickname: { type: 'string', description: 'Nickname del agente asignado (sin @) o "all" para todos' },
        fecha_limite: { type: 'string', description: 'Fecha y hora límite en ISO 8601, p. ej. 2026-11-10T18:00' },
        checklist: { type: 'array', items: { type: 'string' }, description: 'Pasos de la tarea' }
      },
      required: ['titulo', 'agente_nickname', 'fecha_limite', 'checklist'],
      additionalProperties: false
    }
  },
  {
    name: 'programar_mensaje',
    description: 'Programa un mensaje que se publicará automáticamente en el chat del equipo en la fecha indicada (recordatorios, avisos).',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string' },
        agente_nickname: { type: 'string', description: 'Nickname del agente destinatario (sin @) o "all"' },
        fecha_envio: { type: 'string', description: 'Fecha y hora de envío en ISO 8601' }
      },
      required: ['texto', 'agente_nickname', 'fecha_envio'],
      additionalProperties: false
    }
  },
  {
    name: 'agregar_lead_crm',
    description: 'Añade un posible cliente (alumno) al pipeline del CRM de Instagram.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        instagram_user: { type: 'string', description: 'Usuario de Instagram sin @' },
        interes: { type: 'string', description: 'Qué le interesa, p. ej. "Plan híbrido Hyrox"' },
        origen: { type: 'string', enum: ['Reel', 'Story', 'Bio Link', 'DM Directo', 'Anuncio Meta', 'TikTok', 'WhatsApp Directo'] },
        valor_estimado: { type: 'number', description: 'Valor estimado en euros' },
        notas: { type: 'string' }
      },
      required: ['nombre', 'instagram_user', 'interes', 'origen', 'valor_estimado', 'notas'],
      additionalProperties: false
    }
  },
  {
    name: 'agregar_prospecto_coach',
    description: 'Añade un coach o entrenador real (verificado con web_search) al Cazador B2B del CRM como prospecto para vender la app TJ FitLab.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        username: { type: 'string', description: 'Usuario principal sin @' },
        canal: { type: 'string', enum: ['Instagram', 'TikTok', 'WhatsApp', 'Web', 'LinkedIn'] },
        especialidad: { type: 'string' },
        ubicacion: { type: 'string' },
        seguidores: { type: 'number', description: 'Seguidores aproximados (0 si no se sabe)' },
        fuente_url: { type: 'string', description: 'URL donde se verificó el perfil' },
        pain_point: { type: 'string', description: 'Problema que TJ FitLab le resolvería' },
        pitch: { type: 'string', description: 'Propuesta de valor en una frase' },
        dm_sugerido: { type: 'string', description: 'Borrador de DM para que el jefe lo envíe' }
      },
      required: ['nombre', 'username', 'canal', 'especialidad', 'ubicacion', 'seguidores', 'fuente_url', 'pain_point', 'pitch', 'dm_sugerido'],
      additionalProperties: false
    }
  }
];

const ACTION_NAMES = new Set(ACTION_TOOLS.map(t => t.name));

// Validación mínima de las entradas antes de devolverlas a la app
function isValidAction(name: string, input: any): boolean {
  const tool = ACTION_TOOLS.find(t => t.name === name);
  if (!tool || !input || typeof input !== 'object') return false;
  const required = (tool.input_schema as any).required as string[];
  return required.every(k => input[k] !== undefined && input[k] !== null);
}


// ---------------------------------------------------------------------------
// GEMINI: búsqueda con Google Search + acciones con function calling
// ---------------------------------------------------------------------------

// Convierte el JSON Schema de las herramientas al formato de esquema de Gemini
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue;
    if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v as any).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
    else if (k === 'items') out.items = toGeminiSchema(v);
    else out[k] = v;
  }
  return out;
}

const GEMINI_FUNCTIONS = ACTION_TOOLS.map(t => ({
  name: t.name,
  description: t.description,
  parameters: toGeminiSchema(t.input_schema)
}));

class GeminiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(id); }
}

// Último modelo que respondió bien: se prueba primero en las siguientes llamadas
let preferredModel = '';

// Llama a generateContent probando modelos en orden si alguno no existe, está saturado o sin cuota.
// stopOn429: para Google Search la cuota es de la cuenta, así que no tiene sentido probar otros modelos.
async function geminiGenerate(apiKey: string, body: any, opts: { stopOn429?: boolean } = {}): Promise<any> {
  let last: GeminiError | null = null;
  const order = preferredModel ? [preferredModel, ...GEMINI_MODELS.filter(m => m !== preferredModel)] : GEMINI_MODELS;
  for (const model of order) {
    let r: Response;
    try {
      r = await fetchWithTimeout(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, 25000);
    } catch {
      last = new GeminiError(504, `Gemini (${model}) no respondió a tiempo`);
      continue;
    }
    const data: any = await r.json().catch(() => ({}));
    if (r.ok) { preferredModel = model; return data; }
    last = new GeminiError(r.status, data?.error?.message || `Gemini respondió ${r.status}`);
    if (r.status === 429 && opts.stopOn429) break;
    if (model === preferredModel) preferredModel = '';
    // 404 modelo no disponible, 429 cuota agotada, 5xx saturado: probar el siguiente modelo.
    // 400/401/403 (clave inválida o petición incorrecta): no tiene sentido seguir.
    if (![404, 429, 500, 503].includes(r.status)) break;
  }
  throw last || new GeminiError(500, 'Gemini no respondió');
}

const partsText = (data: any) =>
  (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();

// ---------------------------------------------------------------------------
// BÚSQUEDA GRATUITA PROPIA (sin clave): Bing, con DuckDuckGo de respaldo,
// y lectura del texto de páginas. Gemini la usa cuando no sabe algo.
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
type SearchResult = { title: string; url: string; snippet: string };

const decodeHtml = (t: string) => t
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();


async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const r = await fetchWithTimeout('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `q=${encodeURIComponent(query)}&kl=es-es`
  });
  if (r.status !== 200) return []; // 202 = desafío anti-bots
  const html = await r.text();
  const results: SearchResult[] = [];
  const blocks = html.split('result__body').slice(1);
  for (const b of blocks) {
    const a = b.match(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let url = a[1];
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    if (!/^https?:\/\//.test(url) || url.includes('duckduckgo.com/y.js')) continue; // anuncios
    const sn = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    results.push({ title: decodeHtml(a[2]), url, snippet: sn ? decodeHtml(sn[1]) : '' });
    if (results.length >= 6) break;
  }
  return results;
}

async function searchBing(query: string): Promise<SearchResult[]> {
  const r = await fetchWithTimeout(`https://www.bing.com/search?setlang=es&cc=ES&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA } });
  const html = await r.text();
  const results: SearchResult[] = [];
  for (const b of html.split('<li class="b_algo"').slice(1)) {
    const a = b.match(/<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const sn = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({ title: decodeHtml(a[2]), url: a[1].replace(/&amp;/g, '&'), snippet: sn ? decodeHtml(sn[1]) : '' });
    if (results.length >= 6) break;
  }
  return results;
}

// Bing primero (estable desde servidores); DuckDuckGo de respaldo (bloquea con 202 "anomaly" si hay muchas consultas)
async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const bing = await searchBing(query);
    if (bing.length) return bing;
  } catch { /* probar DuckDuckGo */ }
  try { return await searchDuckDuckGo(query); } catch { return []; }
}

// Lee el texto principal de una página pública (bloquea direcciones internas)
async function readPage(url: string): Promise<string> {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('URL inválida'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Solo se permiten URLs http(s)');
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(u.hostname) || !u.hostname.includes('.')) {
    throw new Error('Dirección no permitida');
  }
  const r = await fetchWithTimeout(u.toString(), { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' } }, 9000);
  if (!r.ok) throw new Error(`La página respondió ${r.status}`);
  const html = (await r.text()).slice(0, 600000);
  const text = decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|footer|header|svg|noscript)[\s\S]*?<\/\1>/gi, ' '));
  return text.slice(0, 7000);
}

const RESEARCH_FUNCTIONS = [
  {
    name: 'buscar_en_internet',
    description: 'Busca en internet (gratis) y devuelve títulos, URLs y extractos. Úsala cuando no sepas algo con certeza o necesites datos actuales, fechas, perfiles reales, precios, estudios o estadísticas.',
    parameters: { type: 'OBJECT', properties: { consulta: { type: 'STRING', description: 'Consulta de búsqueda concreta, en español o inglés' } }, required: ['consulta'] }
  },
  {
    name: 'leer_pagina',
    description: 'Lee el texto de una página web de los resultados de búsqueda para obtener los datos concretos. Úsala en los 1-3 resultados más relevantes antes de responder.',
    parameters: { type: 'OBJECT', properties: { url: { type: 'STRING' } }, required: ['url'] }
  }
];

// Si Google Search (grounding) no tiene cuota, no reintentarlo durante 1 hora
let groundingBlockedUntil = 0;

async function runGemini(apiKey: string, prompt: string, system: string, webSearch: boolean, allowActions: boolean) {
  const started = Date.now();
  const DEADLINE_MS = 100000; // margen bajo el límite de 120 s de la función
  const sources: { title: string; url: string }[] = [];
  const addSource = (title: string, url: string) => { if (url && !sources.some(s => s.url === url)) sources.push({ title: title || url, url }); };

  // Paso 1 (opcional): Google Search integrado de Gemini, si la cuenta tiene cuota
  let researchText = '';
  if (webSearch && Date.now() > groundingBlockedUntil) {
    try {
      const research = await geminiGenerate(apiKey, {
        systemInstruction: { parts: [{ text: `${system}\nUsa Google Search siempre que necesites datos actuales, perfiles reales, estudios o estadísticas, y cita las fuentes. Nunca inventes cifras ni URLs.` }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      }, { stopOn429: true });
      researchText = partsText(research);
      for (const chunk of research?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
        if (chunk?.web?.uri) addSource(chunk.web.title, chunk.web.uri);
      }
    } catch (e) {
      if (!(e instanceof GeminiError && e.status === 429)) throw e;
      groundingBlockedUntil = Date.now() + 3600000; // sin cuota: usar la búsqueda propia
    }
  }

  // Paso 2: agente con herramientas. Si no hubo Google Search, investiga con la búsqueda propia.
  const functions = [
    ...(webSearch ? RESEARCH_FUNCTIONS : []),
    ...(allowActions ? GEMINI_FUNCTIONS : [])
  ];
  const instructions = researchText
    ? `INVESTIGACIÓN PREVIA (Google Search):\n${researchText}\n\nFUENTES:\n${sources.map(s => `- ${s.title}: ${s.url}`).join('\n') || '(ninguna)'}\n\n`
    : '';
  const userTurn = `PETICIÓN DEL JEFE:\n${prompt}\n\n${instructions}CÓMO TRABAJAR:
1. Si te falta información o no estás seguro (datos actuales, fechas, perfiles, cifras, estudios), usa buscar_en_internet y después leer_pagina en los 1-3 resultados más relevantes. Basa tu respuesta SOLO en lo que encuentres y cita las URLs.
2. Si el jefe pidió HACER algo (publicar, crear tareas, programar mensajes, añadir leads o prospectos), llama a esas funciones con los datos encontrados.
3. Si solo era una pregunta que sabes responder con certeza, responde directamente sin funciones.
4. Termina con la respuesta final para el jefe. Nunca inventes cifras ni URLs.`;

  const actions: { name: string; input: any }[] = [];
  const contents: any[] = [{ role: 'user', parts: [{ text: userTurn }] }];
  let finalText = '';

  if (!functions.length) {
    const only = await geminiGenerate(apiKey, { systemInstruction: { parts: [{ text: system }] }, contents });
    return { text: partsText(only), actions, sources };
  }

  for (let i = 0; i < 10; i++) {
    const outOfTime = Date.now() - started > DEADLINE_MS;
    const step = await geminiGenerate(apiKey, {
      systemInstruction: { parts: [{ text: system + (outOfTime ? '\nSe acabó el tiempo: responde YA con lo que tengas, sin llamar a más funciones.' : '') }] },
      contents,
      ...(outOfTime ? {} : { tools: [{ functionDeclarations: functions }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } })
    });
    const parts = step?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p: any) => p.functionCall);
    const text = parts.map((p: any) => p.text || '').join('').trim();
    if (text) finalText = text;
    if (!calls.length || outOfTime) break;

    contents.push({ role: 'model', parts });
    const responses = await Promise.all(calls.map(async (p: any) => {
      const { name, args } = p.functionCall;
      let response: any;
      if (name === 'buscar_en_internet') {
        const results = await searchWeb(String(args?.consulta || ''));
        results.forEach(r => addSource(r.title, r.url));
        response = results.length ? { resultados: results } : { error: 'Sin resultados; prueba otra consulta.' };
      } else if (name === 'leer_pagina') {
        try {
          const texto = await readPage(String(args?.url || ''));
          response = { url: args.url, texto };
        } catch (e: any) {
          response = { error: `No se pudo leer la página: ${e.message}` };
        }
      } else {
        const ok = ACTION_NAMES.has(name) && isValidAction(name, args);
        if (ok) actions.push({ name, input: args });
        response = { resultado: ok ? 'Hecho: acción registrada en la app.' : 'Error: faltan campos obligatorios o la función no existe.' };
      }
      return { functionResponse: { name, response } };
    }));
    contents.push({ role: 'user', parts: responses });
  }

  return { text: finalText || researchText, actions, sources };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const prompt: string = (body.prompt || '').toString();
  const webSearch: boolean = body.webSearch !== false;
  const allowActions: boolean = body.actions !== false;
  const agentes: { nickname: string; nombre: string; rol: string }[] = Array.isArray(body.agentes) ? body.agentes.slice(0, 30) : [];
  if (!prompt.trim()) {
    return res.status(400).json({ error: 'Falta el prompt' });
  }

  // Elegir motor: Gemini por defecto (gratis); Claude solo si AI_ENGINE=claude
  const geminiKey: string = process.env.GEMINI_API_KEY || (typeof body.geminiKey === 'string' ? body.geminiKey.trim() : '');
  const engine = (process.env.AI_ENGINE || 'gemini').toLowerCase();
  const useClaude = engine === 'claude' && !!process.env.ANTHROPIC_API_KEY;
  if (!useClaude && !geminiKey) {
    return res.status(503).json({ error: 'Falta la clave de Gemini: configura GEMINI_API_KEY en Vercel o en "Configurar IA".' });
  }

  const equipoGemini = agentes.length
    ? `\n\nEquipo disponible para asignar tareas: ${agentes.map(a => `@${a.nickname} (${a.nombre}, ${a.rol})`).join(', ')}.`
    : '';
  if (!useClaude) {
    const systemGemini = `${SYSTEM.replace(/web_search/g, 'Google Search')}${equipoGemini}\nFecha y hora actual: ${new Date().toISOString()}.`;
    try {
      const out = await runGemini(geminiKey, prompt, systemGemini, webSearch, allowActions);
      return res.status(200).json({ ...out, model: 'gemini' });
    } catch (error: any) {
      const status = error instanceof GeminiError ? error.status : 500;
      return res.status(status === 400 || status === 403 ? 401 : status === 429 ? 429 : 502).json({ error: `Gemini: ${error?.message || 'error desconocido'}` });
    }
  }

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    ...(webSearch ? [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] : []),
    ...(allowActions ? ACTION_TOOLS : [])
  ];

  const equipo = agentes.length
    ? `\n\nEquipo disponible para asignar tareas: ${agentes.map(a => `@${a.nickname} (${a.nombre}, ${a.rol})`).join(', ')}.`
    : '';
  const system = `${SYSTEM}${equipo}\nFecha y hora actual: ${new Date().toISOString()}.`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
  const actions: { name: string; input: any }[] = [];
  const texts: string[] = [];
  const sources: { title: string; url: string }[] = [];

  try {
    const client = new Anthropic();
    let response: Anthropic.Beta.BetaMessage | null = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low' }, // rápido para caber en el límite de 60 s
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        tools,
        messages,
      });

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) texts.push(block.text);
        if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content) {
            if (r.type === 'web_search_result' && !sources.some(s => s.url === r.url)) {
              sources.push({ title: r.title, url: r.url });
            }
          }
        }
      }

      if (response.stop_reason === 'refusal') {
        return res.status(422).json({ error: 'El modelo rechazó la solicitud', category: response.stop_details?.category ?? null });
      }

      // Búsqueda web larga: continuar el mismo turno
      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }

      if (response.stop_reason !== 'tool_use') break;

      // Acciones: se registran para que la app las ejecute y se confirma al modelo
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map(tu => {
        if (!ACTION_NAMES.has(tu.name)) {
          return { type: 'tool_result', tool_use_id: tu.id, content: `Herramienta desconocida: ${tu.name}`, is_error: true };
        }
        if (!isValidAction(tu.name, tu.input)) {
          return { type: 'tool_result', tool_use_id: tu.id, content: 'Faltan campos obligatorios; revisa los parámetros y vuelve a intentarlo.', is_error: true };
        }
        actions.push({ name: tu.name, input: tu.input });
        return { type: 'tool_result', tool_use_id: tu.id, content: 'Hecho: la acción se ha registrado en la app de TJ FitLab.' };
      });

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: results });
    }

    if (!response) throw new Error('Sin respuesta');

    // Texto final: la respuesta del último turno (el resumen tras actuar)
    const finalText = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
    const text = finalText || texts.join('\n\n');
    return res.status(200).json({ text, actions, sources, model: response.model });
  } catch (error: any) {
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: 'ANTHROPIC_API_KEY inválida' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Límite de uso alcanzado, reintenta en unos segundos' });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Error de la API de Claude (${error.status}): ${error.message}` });
    }
    return res.status(500).json({ error: error?.message || 'Error desconocido' });
  }
}

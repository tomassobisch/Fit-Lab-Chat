import Anthropic from '@anthropic-ai/sdk';

// Motor de los agentes de TJ FitLab: Claude con búsqueda web y herramientas de acción.
// - La búsqueda web la ejecuta Anthropic en el servidor (web_search).
// - Las acciones (foro, tareas, CRM...) se devuelven a la app, que es quien las aplica.
// La clave ANTHROPIC_API_KEY vive solo en Vercel, nunca en el navegador.

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

const MODEL = 'claude-opus-5-5';
const MAX_ITERATIONS = 6;

// Tiempo máximo de la función en Vercel (60 s es el límite seguro del plan Hobby)
export const config = { maxDuration: 60 };

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const prompt: string = (body.prompt || '').toString();
  const webSearch: boolean = body.webSearch !== false;
  const allowActions: boolean = body.actions !== false;
  const agentes: { nickname: string; nombre: string; rol: string }[] = Array.isArray(body.agentes) ? body.agentes.slice(0, 30) : [];
  if (!prompt.trim()) {
    return res.status(400).json({ error: 'Falta el prompt' });
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

import Anthropic from '@anthropic-ai/sdk';

// Motor de respuesta de los agentes: Claude con búsqueda web en tiempo real.
// La clave ANTHROPIC_API_KEY vive solo en el servidor (Vercel), nunca en el navegador.

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

const MODEL = 'claude-opus-5-5';
const MAX_CONTINUATIONS = 3; // reintentos si la búsqueda web pausa el turno (pause_turn)

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
  if (!prompt.trim()) {
    return res.status(400).json({ error: 'Falta el prompt' });
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
  const tools: Anthropic.Beta.BetaToolUnion[] = webSearch
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }]
    : [];

  try {
    let response: Anthropic.Beta.BetaMessage | null = null;

    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low' }, // respuestas de chat: rápidas y baratas
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        tools,
        messages,
      });

      // La búsqueda web puede pausar un turno largo: se continúa reenviando lo generado
      if (response.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: response.content });
    }

    if (!response) throw new Error('Sin respuesta');

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'El modelo rechazó la solicitud', category: response.stop_details?.category ?? null });
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Fuentes consultadas en la búsqueda web (para citar en el foro)
    const sources: { title: string; url: string }[] = [];
    for (const block of response.content) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === 'web_search_result' && !sources.some(s => s.url === r.url)) {
            sources.push({ title: r.title, url: r.url });
          }
        }
      }
    }

    return res.status(200).json({ text, sources, model: response.model });
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

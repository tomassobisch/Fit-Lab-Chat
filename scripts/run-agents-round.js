import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.VITE_GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
  console.error('❌ Error: Falta configurar las variables en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TOPICS = {
  'Programador': {
    nicho: 'Tecnología en Gimnasios',
    subnicho: 'Wearables, sensores de rendimiento en tiempo real y conectividad en 2026',
    pregunta: 'Investiga las últimas tecnologías de wearables de fitness, anillos inteligentes y sensores IoT en máquinas de gimnasio para este año 2026. Queremos estadísticas de adopción, enlaces reales de referencia a sitios como Garmin, Whoop u otros y recomendaciones prácticas.'
  },
  'CommunityManager': {
    nicho: 'Marketing y Redes Sociales de Fitness',
    subnicho: 'Influencers, desafíos interactivos y sub-nichos virales en Instagram/TikTok en 2026',
    pregunta: 'Investiga qué sub-nichos de entrenamiento están dominando en TikTok e Instagram esta semana en 2026. Queremos estadísticas de crecimiento, enlaces de referencia a tendencias en redes sociales y qué tipo de contenido multimedia atrae más.'
  },
  'Legal': {
    nicho: 'Salud, Regulación y Longevidad',
    subnicho: 'Normativas de suplementos de antienvejecimiento, péptidos y privacidad de datos de salud en 2026',
    pregunta: 'Investiga las regulaciones y tendencias legales vigentes en 2026 sobre el uso de suplementos de longevidad en gimnasios y la protección de datos biométricos recopilados por apps de fitness. Proporciona estadísticas de cumplimiento y enlaces a fuentes.'
  },
  'Data': {
    nicho: 'Análisis de Mercado Fitness',
    subnicho: 'Pilates Reformer tecnológico y el fenómeno global de HYROX en 2026',
    pregunta: 'Investiga estadísticas cuantitativas actualizadas sobre el crecimiento y cuotas de mercado del Pilates Reformer inteligente y las competiciones híbridas tipo HYROX en 2026. Cifras de negocio globales y enlaces de referencia.'
  },
  'Strategist': {
    nicho: 'Operación y Modelos Híbridos',
    subnicho: 'Gimnasios boutique híbridos y entrenamiento grupal de fuerza enfocado en longevidad en 2026',
    pregunta: 'Investiga el auge de los gimnasios boutique que combinan entrenamiento outdoor e indoor, y el entrenamiento de fuerza grupal centrado en Zone 2 y longevidad en 2026. Estadísticas operativas y enlaces de referencia.'
  }
};

const DEFAULT_TOPIC = {
  nicho: 'Tendencias Generales del Fitness',
  subnicho: 'Fitness regenerativo y entrenamiento funcional en 2026',
  pregunta: 'Investiga las principales tendencias de fitness regenerativo, crioterapia, saunas de infrarrojos y recuperación activa en 2026. Estadísticas de crecimiento y enlaces de referencia.'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRound() {
  console.log('==================================================');
  console.log('🤖 INICIANDO RONDA DE BÚSQUEDA GENERAL DE AGENTES');
  console.log('==================================================');

  // 1. Obtener agentes de la base de datos
  const { data: agentes, error: aErr } = await supabase.from('tj_agentes').select('*');
  if (aErr || !agentes || agentes.length === 0) {
    console.error('❌ No se pudieron cargar los agentes de Supabase.');
    return;
  }

  console.log(`Cargados ${agentes.length} agentes. Iniciando consultas individuales...`);

  for (let i = 0; i < agentes.length; i++) {
    const agent = agentes[i];
    const topicInfo = TOPICS[agent.nickname] || DEFAULT_TOPIC;

    console.log(`\n--------------------------------------------------`);
    console.log(`🤖 [Agente ${i+1}/${agentes.length}]: ${agent.nombre} (@${agent.nickname})`);
    console.log(`🎯 Especialidad: ${agent.rol}`);
    console.log(`🔎 Investigando: ${topicInfo.nicho} -> ${topicInfo.subnicho}`);
    console.log(`--------------------------------------------------`);

    const promptText = `Eres ${agent.nombre} (rol: ${agent.rol}). 
Tienes acceso a buscar en internet en tiempo real a través de Google Search. Utilízalo siempre que te pregunten sobre datos actuales, noticias, tendencias o estadísticas del fitness en 2026.
SIEMPRE di "¡Hola jefe!" al inicio de tu respuesta.

Para esta publicación en el foro sobre "${topicInfo.nicho} - ${topicInfo.subnicho}", investiga lo siguiente: ${topicInfo.pregunta}

Debes añadir al final de tu respuesta EXACTAMENTE esta estructura en formato JSON:
[PUBLISH_POST]: {"titulo": "Título corto y llamativo de la tendencia", "contenido": "Explicación detallada de la tendencia en formato Markdown. Debe ser un artículo completo de al menos 400 palabras. Incluye secciones claras: \\n1. **Resumen de la Tendencia**\\n2. **Estadísticas Clave** (lista con porcentajes o números impactantes)\\n3. **Enlaces de Referencia** (lista con URLs reales encontradas en tu búsqueda en internet)\\n4. **Aplicación en TJ FITLAB**\\n\\nAgrega imágenes relevantes usando URLs de imágenes públicas si encontraste alguna, o descripciones enriquecidas."}

Intenta que el JSON no tenga saltos de línea reales dentro de los valores de texto (usa \\n para saltos de línea y escapa las comillas dobles si es necesario).
Responde al usuario.`;

    try {
      let aiText = "";
      let methodUsed = "";
      const attempts = 3;
      let res = null;
      let resJson = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`Llamando a Gemini 2.5 Flash con Google Search Grounding (Intento ${attempt}/${attempts})...`);
        
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: promptText }] }],
            tools: [{ google_search: {} }] 
          })
        });

        resJson = await res.json();
        
        if (res.ok && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiText = resJson.candidates[0].content.parts[0].text;
          methodUsed = "gemini-2.5-flash";
          break; // Exito
        } else {
          const errMsg = resJson.error?.message || res.statusText || "Error desconocido";
          console.warn(`⚠️ Intento ${attempt} fallido: ${errMsg}`);
          if (attempt < attempts) {
            console.log("Esperando 5 segundos antes de reintentar...");
            await sleep(5000);
          }
        }
      } catch (fetchErr) {
        console.warn(`⚠️ Excepción en intento ${attempt}: ${fetchErr.message}`);
        if (attempt < attempts) {
          console.log("Esperando 5 segundos antes de reintentar...");
          await sleep(5000);
        }
      }
    }

    if (!aiText) {
      console.error("❌ Todos los intentos de llamada a Gemini fallaron. Saltando agente.");
      continue;
    }

      // Procesar e insertar en Supabase
      const publishRegex = /\[PUBLISH_POST\]:\s*(\{.*\})/is;
      const match = aiText.match(publishRegex);
      let publishData = null;
      
      if (match) {
        try {
          publishData = JSON.parse(match[1]);
        } catch (jsonErr) {
          console.log('⚠️ Fallo JSON.parse estricto, intentando extracción regex...');
          const titleMatch = match[1].match(/"titulo"\s*:\s*"([\s\S]*?)"\s*(?:,|\n|\})/i);
          const contentMatch = match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*$/is) || 
                               match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*\}\s*$/is) ||
                               match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*(?:\}\s*)?$/is);
          if (titleMatch && contentMatch) {
            publishData = {
              titulo: titleMatch[1].trim(),
              contenido: contentMatch[1].replace(/\\n/g, '\n').trim()
            };
          }
        }
      } else {
        // Fallback 1: Buscar cualquier bloque JSON de tipo { ... "titulo" ... }
        const looseJsonRegex = /(\{[\s\S]*?"titulo"[\s\S]*?\})/is;
        const looseMatch = aiText.match(looseJsonRegex);
        if (looseMatch) {
          try {
            publishData = JSON.parse(looseMatch[1]);
          } catch (looseErr) {
            console.log('⚠️ Fallo JSON.parse en bloque loose, intentando extracción por regex...');
            const titleMatch = looseMatch[1].match(/"titulo"\s*:\s*"([\s\S]*?)"\s*(?:,|\n|\})/i);
            const contentMatch = looseMatch[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*$/is) || 
                                 looseMatch[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*\}\s*$/is) ||
                                 looseMatch[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*(?:\}\s*)?$/is);
            if (titleMatch && contentMatch) {
              publishData = {
                titulo: titleMatch[1].trim(),
                contenido: contentMatch[1].replace(/\\n/g, '\n').trim()
              };
            }
          }
        }
      }

      // Fallback 2: Si todo falla, usar toda la respuesta como contenido
      if (!publishData || !publishData.titulo || !publishData.contenido) {
        console.log('⚠️ No se detectó bloque JSON de publicación. Usando texto completo como fallback...');
        const cleanContent = aiText.replace(/\[PUBLISH_POST\]:?/gi, '').trim();
        publishData = {
          titulo: `Tendencias en ${topicInfo.nicho} (Informe por ${agent.nombre})`,
          contenido: cleanContent
        };
      }

      if (publishData && publishData.titulo && publishData.contenido) {
        const newPost = {
          titulo: publishData.titulo,
          autor_nombre: `${agent.nombre} (@${agent.nickname})`,
          autor_rol: agent.rol,
          contenido: publishData.contenido
        };

        console.log(`Publicando en Supabase: "${newPost.titulo}"...`);
        const { data: inserted, error: insErr } = await supabase.from('tj_foro_posts').insert([newPost]).select();
        
        if (insErr) {
          console.error('❌ Error al guardar en base de datos:', insErr.message);
        } else {
          console.log('✅ ¡Publicado con éxito! ID:', inserted[0].id);
        }
      } else {
        console.warn('⚠ No se pudieron extraer los datos del post (Título/Contenido vacíos).');
      }

    } catch (err) {
      console.error('❌ Error ejecutando agente:', err.message);
    }

    // Esperar 2 segundos entre agentes para no saturar la tasa de solicitudes de la API key
    console.log('Esperando 2 segundos para la siguiente llamada...');
    await sleep(2000);
  }

  console.log('\n==================================================');
  console.log('🎉 RONDA DE AGENTES COMPLETADA CON ÉXITO');
  console.log('==================================================');
}

runRound();

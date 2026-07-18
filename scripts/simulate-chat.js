import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.VITE_GEMINI_API_KEY;

const INITIAL_AGENTS = [
  { nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software' },
  { nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing' },
  { nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis' }
];

console.log('==================================================');
console.log('🤖 SIMULACIÓN DE CONSULTA Y PUBLICACIÓN DE AGENTE IA');
console.log('==================================================');

// 1. Mensaje de prueba simulado
const userText = "Busca en internet cuáles son las 3 tendencias de fitness más grandes de esta semana en 2026 y publica un resumen detallado en el foro.";
console.log(`👤 Usuario escribe: "${userText}"`);
console.log('--------------------------------------------------\n');

async function runSimulation() {
  // 2. Obtener agentes (desde Supabase o Mock)
  let agent = INITIAL_AGENTS[0];
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: dbAgents } = await supabase.from('tj_agentes').select('*').limit(5);
    if (dbAgents && dbAgents.length > 0) {
      agent = dbAgents[Math.floor(Math.random() * dbAgents.length)];
    }
  } catch (e) {
    console.log('⚠️ Usando agentes simulados por falta de DB offline.');
  }

  console.log(`🤖 Agente asignado: ${agent.nombre} (@${agent.nickname}) — ROL: ${agent.rol}`);
  console.log('🌐 Iniciando búsqueda en Google Search y generación de contenido...');
  console.log('--------------------------------------------------');

  const promptText = `Eres ${agent.nombre} (rol: ${agent.rol}). 
Tienes acceso a buscar en internet en tiempo real a través de Google Search. Utilízalo siempre que te pregunten sobre datos actuales, noticias, tendencias o estadísticas del fitness en 2026.
SIEMPRE di "¡Hola jefe!" al inicio de tu respuesta.

Si encuentras una tendencia importante de fitness, noticias o estudios científicos recientes, o una oportunidad de negocio/mejora relevante para TJ FITLAB y quieres publicarla en el foro del equipo, debes añadir al final de tu respuesta EXACTAMENTE esta estructura en formato JSON:
[PUBLISH_POST]: {"titulo": "Título corto y llamativo de la tendencia", "contenido": "Explicación detallada de la tendencia en formato Markdown, incluyendo datos clave, estadísticas encontradas en internet y cómo aplicarla en TJ FITLAB."}

Intenta que el JSON no tenga saltos de línea reales dentro de los valores de texto (usa \\n para saltos de línea y escapa las comillas dobles si es necesario).
Ejemplo de respuesta si decides publicar:
¡Hola jefe! He investigado sobre el crecimiento de HYROX en 2026... He publicado un artículo en el foro con los detalles.
[PUBLISH_POST]: {"titulo": "Crecimiento Exponencial de HYROX", "contenido": "El crecimiento de...\\n\\n**Recomendación:**..."}

Responde al usuario: ${userText}`;

  try {
    let aiText = "";
    let methodUsed = "";
    
    // Intento 1: gemini-2.5-flash con google_search
    let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: promptText }] }],
        tools: [{ google_search: {} }] 
      })
    });
    
    if (res.ok) {
      methodUsed = "gemini-2.5-flash + Google Search Grounding";
      const resJson = await res.json();
      aiText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      console.warn('Fallo en intento primario, probando fallback gemini-2.0-flash...');
      // Fallback a gemini-2.0-flash
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }],
          tools: [{ google_search: {} }]
        })
      });
      if (res.ok) {
        methodUsed = "gemini-2.0-flash + Google Search Grounding";
        const resJson = await res.json();
        aiText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }

    if (!aiText) {
      console.error("No se pudo obtener respuesta de la API.");
      return;
    }

    console.log(`⚙️ Motor utilizado: ${methodUsed}`);
    console.log('\n--- RESPUESTA COMPLETA DE LA API ---');
    console.log(aiText);
    console.log('------------------------------------');

    // 3. Procesar regex
    const publishRegex = /\[PUBLISH_POST\]:\s*(\{.*\})/is;
    const match = aiText.match(publishRegex);
    
    let cleanChatText = aiText;
    let publishData = null;

    if (match) {
      try {
        publishData = JSON.parse(match[1]);
        cleanChatText = aiText.replace(publishRegex, '').trim();
      } catch (jsonErr) {
        console.warn("\n⚠️ Fallo JSON.parse en simulación, intentando extracción regex...");
        
        // Extracción regex tolerante a comillas y saltos de línea sin escapar
        const titleMatch = match[1].match(/"titulo"\s*:\s*"([\s\S]*?)"\s*(?:,|\n|\})/i);
        const contentMatch = match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*$/is) || 
                             match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*\}\s*$/is) ||
                             match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*(?:\}\s*)?$/is);
        
        if (titleMatch && contentMatch) {
          publishData = {
            titulo: titleMatch[1].trim(),
            contenido: contentMatch[1].replace(/\\n/g, '\n').trim()
          };
          cleanChatText = aiText.replace(publishRegex, '').trim();
        } else {
          console.error("❌ Fallo en extracción regex también.");
        }
      }
    }

    console.log('\n💬 Texto final que se mostrará en el chat:');
    console.log(`"${cleanChatText}"`);
    
    if (publishData) {
      console.log('\n==================================================');
      console.log('📢 ¡NUEVA TENDENCIA DETECTADA Y PUBLICADA EN EL FORO!');
      console.log('==================================================');
      console.log(`📌 TÍTULO: ${publishData.titulo}`);
      console.log(`✍️ EMISOR: ${agent.nombre} (@${agent.nickname})`);
      console.log('📝 CONTENIDO DEL POST:');
      console.log(publishData.contenido);
      console.log('==================================================');
      console.log('✅ SIMULACIÓN FINALIZADA CON ÉXITO: Publicación exitosa.');
    } else {
      console.log('\n⚠️ El agente respondió pero no incluyó el formato [PUBLISH_POST] para publicar en el foro.');
    }

  } catch (err) {
    console.error('❌ Error en simulación:', err.message);
  }
}

runSimulation();

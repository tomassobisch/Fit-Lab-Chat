import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.VITE_GEMINI_API_KEY;

console.log('==================================================');
console.log('🧪 DIAGNÓSTICO DE VARIABLES DE ENTORNO Y CLAVES');
console.log('==================================================');
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'No definida');
console.log('Gemini Key:', geminiKey ? `${geminiKey.substring(0, 10)}...` : 'No definida');
console.log('--------------------------------------------------\n');

async function testSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase: Faltan variables en el archivo .env');
    return false;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('tj_agentes').select('count', { count: 'exact' });
    
    if (error) {
      console.log('❌ Supabase Conexión fallida:', error.message);
      return false;
    } else {
      console.log('✅ Supabase Conexión exitosa! Total agentes en DB:', data);
      return true;
    }
  } catch (e) {
    console.log('❌ Supabase Exception:', e.message);
    return false;
  }
}

async function testGemini() {
  if (!geminiKey) {
    console.log('❌ Gemini: Falta VITE_GEMINI_API_KEY en el archivo .env');
    return false;
  }
  
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();
    
    if (!listRes.ok) {
      console.log('❌ Gemini API Error (List Models):', listData.error?.message || listRes.statusText);
      return false;
    }
    
    const modelNames = listData.models?.map(m => m.name.replace('models/', '')) || [];
    console.log('Modelos disponibles en tu API key:', modelNames.join(', '));
    
    const genModel = listData.models?.find(m => m.supportedGenerationMethods?.includes('generateContent'));
    if (!genModel) {
      console.log('❌ No se encontró ningún modelo que soporte generateContent.');
      return false;
    }
    
    console.log(`Probando generación con modelo: ${genModel.name.replace('models/', '')}...`);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${genModel.name}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Di "Conexión exitosa" en 3 palabras.' }] }]
      })
    });
    
    const data = await response.json();
    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('✅ Gemini Conexión exitosa! Respuesta de la IA:', data.candidates[0].content.parts[0].text.trim());
      return true;
    } else {
      console.log('❌ Gemini API Error:', data.error?.message || response.statusText);
      return false;
    }
  } catch (e) {
    console.log('❌ Gemini Exception:', e.message);
    return false;
  }
}

async function runAll() {
  const sbOk = await testSupabase();
  const geminiOk = await testGemini();
  
  console.log('\n==================================================');
  if (sbOk && geminiOk) {
    console.log('🎉 ¡EXCELENTE! Todas las claves están funcionando y conectadas.');
  } else {
    console.log('⚠️ Revisa los errores anteriores para solucionar la conexión.');
  }
  console.log('==================================================');
}

runAll();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv'; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMessages() {
  console.log('--- DIAGNÓSTICO DE BASE DE DATOS (tj_mensajes) ---');
  
  try {
    const { data, error, count } = await supabase
      .from('tj_mensajes')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ ERROR AL LEER TABLA:', error.message);
      if (error.message.includes('relation "tj_mensajes" does not exist')) {
        console.log('Sugerencia: La tabla "tj_mensajes" no existe. Revisa si ejecutaste el SQL en el proyecto correcto.');
      }
      return;
    }

    console.log(`✅ CONEXIÓN EXITOSA. Total de mensajes en DB: ${count}`);
    
    if (data && data.length > 0) {
      console.log('\nÚltimos 5 mensajes encontrados:');
      data.forEach(m => {
        console.log(`[${m.creado_en}] ${m.remitente_tipo}: ${m.texto.substring(0, 50)}...`);
      });
    } else {
      console.log('⚠️ LA TABLA ESTÁ VACÍA. Los mensajes no se están guardando.');
    }

  } catch (err) {
    console.error('❌ ERROR CRÍTICO:', err.message);
  }
}

checkMessages();

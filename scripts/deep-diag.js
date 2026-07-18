import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv'; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDiagnostic() {
  console.log('--- DIAGNÓSTICO PROFUNDO DE BASE DE DATOS ---');
  
  // 1. Check tj_mensajes
  const { count: msgCount, error: msgErr } = await supabase.from('tj_mensajes').select('*', { count: 'exact', head: true });
  console.log(`tj_mensajes: ${msgErr ? 'ERROR: ' + msgErr.message : msgCount + ' filas'}`);

  // 2. Check tj_agentes
  const { data: agents, error: agentErr } = await supabase.from('tj_agentes').select('id, nickname');
  console.log(`tj_agentes: ${agentErr ? 'ERROR: ' + agentErr.message : agents.length + ' agentes'}`);

  // 3. Check tj_reportes (Anytime Panel)
  const { data: reports, error: reportErr } = await supabase.from('tj_reportes').select('*').order('creado_en', { ascending: false }).limit(1);
  console.log(`tj_reportes: ${reportErr ? 'ERROR: ' + reportErr.message : (reports.length > 0 ? 'DATOS PRESENTES' : 'VACÍA')}`);
  if (reports && reports[0]) {
    console.log('Último reporte:', JSON.stringify(reports[0], null, 2));
  }

  // 4. Check Realtime Public (common cause for sync failure)
  console.log('\n--- VERIFICACIÓN DE POLÍTICAS ---');
  console.log('Si los conteos son > 0 pero la web no muestra nada, es probable que RLS esté bloqueando el SELECT o que Realtime no esté habilitado para estas tablas.');
}

deepDiagnostic();

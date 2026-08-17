import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv';

const supabase = createClient(supabaseUrl, supabaseKey);

const newAgent = {
  nombre: 'Reel & Script Architect',
  nickname: 'ReelArchitect',
  rol: 'Guionista Viral & Director de Contenido',
  skills: 'Guiones Virales 3s Hook, Retención, Plantillas CapCut/Premiere, Storytelling Híbrido, CTA de Conversión DM',
  avatar_url: '/avatars/reelarchitect.png',
  estado_online: true
};

async function addAgent() {
  console.log('Insertando/actualizando nuevo bot ReelArchitect en Supabase...');
  const { data, error } = await supabase
    .from('tj_agentes')
    .upsert([newAgent], { onConflict: 'nickname' })
    .select();

  if (error) {
    console.error('❌ Error al insertar agente:', error.message);
  } else {
    console.log('✅ ¡Bot @ReelArchitect agregado con éxito a Supabase!', data);
  }
}

addAgent();

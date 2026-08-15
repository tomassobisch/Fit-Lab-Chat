import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv';

const supabase = createClient(supabaseUrl, supabaseKey);

const newAgent = {
  nombre: 'InstaMetrics Pro',
  nickname: 'InstaAnalyst',
  rol: 'Analista Métricas Instagram & Growth',
  skills: 'Instagram Graph API, Engagement Rate, Reels Analytics, Audiencias, Conversión, Meta Insights',
  avatar_url: '/avatars/instaanalyst.png',
  estado_online: true
};

async function addAgent() {
  console.log('Insertando/actualizando nuevo bot de Instagram en Supabase...');
  const { data, error } = await supabase
    .from('tj_agentes')
    .upsert([newAgent], { onConflict: 'nickname' })
    .select();

  if (error) {
    console.error('❌ Error al insertar agente:', error.message);
  } else {
    console.log('✅ ¡Bot de Instagram agregado con éxito a la base de datos!', data);
  }
}

addAgent();

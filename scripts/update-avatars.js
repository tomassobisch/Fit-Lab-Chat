import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv';

const supabase = createClient(supabaseUrl, supabaseKey);

const mapping = [
  { nickname: 'Programador', avatar_url: '/avatars/1.png' },
  { nickname: 'CommunityManager', avatar_url: '/avatars/2.png' },
  { nickname: 'Legal', avatar_url: '/avatars/3.png' },
  { nickname: 'Data', avatar_url: '/avatars/4.png' },
  { nickname: 'Strategist', avatar_url: '/avatars/5.png' }
];

async function updateAvatars() {
  console.log('Actualizando avatares en Supabase...');
  for (const item of mapping) {
    const { error } = await supabase
      .from('tj_agentes')
      .update({ avatar_url: item.avatar_url })
      .eq('nickname', item.nickname);
      
    if (error) {
      console.error(`❌ Error al actualizar @${item.nickname}:`, error.message);
    } else {
      console.log(`✅ Actualizado @${item.nickname} -> ${item.avatar_url}`);
    }
  }
}

updateAvatars();

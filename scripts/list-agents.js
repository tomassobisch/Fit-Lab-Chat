import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAgents() {
  const { data, error } = await supabase
    .from('tj_agentes')
    .select('id, nombre, nickname, rol');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

listAgents();

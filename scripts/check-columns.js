import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Consultando columnas de tj_agentes...');
  const { data, error } = await supabase.from('tj_agentes').select('*').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Columnas disponibles:', Object.keys(data[0] || {}));
  }
}

checkColumns();

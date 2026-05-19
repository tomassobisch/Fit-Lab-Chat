import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable() {
  console.log('Probando conexión a tj_reportes...');
  const { data, error } = await supabase.from('tj_reportes').select('*').limit(1);
  
  if (error) {
    console.error('Error:', error.message);
    console.error('Código:', error.code);
  } else {
    console.log('Conexión exitosa. Datos:', data);
  }
}

testTable();

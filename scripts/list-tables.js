import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for metadata

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // This might not exist
  if (error) {
    // Fallback: try to select from a known table to see if the client works
    const { data: d2, error: e2 } = await supabase.from('tj_mensajes').select('count');
    console.log('tj_mensajes count:', d2);
    console.error('List tables error:', error.message);
  } else {
    console.log('Tables:', data);
  }
}

listTables();

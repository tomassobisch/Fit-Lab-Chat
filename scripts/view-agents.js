import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv';

const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
  const { data, error } = await supabase.from('tj_agentes').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(data);
  }
}
list();

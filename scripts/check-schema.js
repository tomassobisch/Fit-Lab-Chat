import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son necesarios.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    console.log('Intentando crear tabla tj_reportes...');
    
    const sql = `
        CREATE TABLE IF NOT EXISTS tj_reportes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            total_alumnos INTEGER DEFAULT 0,
            mensajes_pendientes INTEGER DEFAULT 0,
            pendientes_escaneo JSONB DEFAULT '[]'::jsonb,
            sin_respuesta JSONB DEFAULT '[]'::jsonb,
            creado_en TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE tj_reportes ENABLE ROW LEVEL SECURITY;
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso total reportes') THEN
                CREATE POLICY "Acceso total reportes" ON tj_reportes FOR ALL USING (true) WITH CHECK (true);
            END IF;
        END $$;
    `;

    // Como no podemos ejecutar SQL arbitrario fácilmente por API sin extensiones, 
    // intentaremos insertar un registro de prueba. Si la tabla no existe, fallará.
    const { error } = await supabase.from('tj_reportes').select('*').limit(1);
    
    if (error && error.code === '42P01') {
        console.error('La tabla tj_reportes no existe en Supabase.');
        console.log('POR FAVOR: Copia y pega el contenido de "tj_reportes_schema.sql" en el SQL Editor de tu Dashboard de Supabase.');
    } else {
        console.log('La tabla ya existe o está lista para usarse.');
    }
}

setup();

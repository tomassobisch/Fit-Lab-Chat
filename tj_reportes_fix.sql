-- SQL Corregido para evitar errores de duplicación de publicación
-- Ejecuta esto en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS tj_reportes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_alumnos INTEGER DEFAULT 0,
    mensajes_pendientes INTEGER DEFAULT 0,
    pendientes_escaneo JSONB DEFAULT '[]'::jsonb,
    sin_respuesta JSONB DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE tj_reportes ENABLE ROW LEVEL SECURITY;

-- Crear política solo si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso total reportes') THEN
        CREATE POLICY "Acceso total reportes" ON tj_reportes FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Añadir a la publicación de tiempo real de forma segura
-- Si falla esta línea, no te preocupes, la tabla ya estará creada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tj_reportes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tj_reportes;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo añadir a la publicación, puede que ya exista.';
END $$;

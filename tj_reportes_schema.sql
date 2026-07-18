-- SQL para crear la tabla de reportes estructurados
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
CREATE POLICY "Acceso total reportes" ON tj_reportes FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tj_reportes;

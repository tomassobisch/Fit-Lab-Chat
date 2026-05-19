-- SQL Simplificado para evitar errores de sintaxis
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS tj_reportes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_alumnos INTEGER DEFAULT 0,
    mensajes_pendientes INTEGER DEFAULT 0,
    pendientes_escaneo JSONB DEFAULT '[]'::jsonb,
    sin_respuesta JSONB DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar seguridad
ALTER TABLE tj_reportes ENABLE ROW LEVEL SECURITY;

-- 3. Crear política (Si falla porque ya existe, puedes ignorar el error)
CREATE POLICY "Acceso total reportes" ON tj_reportes FOR ALL USING (true) WITH CHECK (true);

-- 4. Intentar añadir a Realtime (Si falla porque ya existe, puedes ignorar el error)
ALTER PUBLICATION supabase_realtime ADD TABLE tj_reportes;

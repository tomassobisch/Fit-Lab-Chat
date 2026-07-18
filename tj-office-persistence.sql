-- TJOffice REBORN - Schema Oficial
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Limpieza (Opcional, ten cuidado si ya tienes datos)
-- DROP TABLE IF EXISTS tj_mensajes;
-- DROP TABLE IF EXISTS tj_agentes;

-- 2. Tabla de Agentes Especialistas
CREATE TABLE IF NOT EXISTS tj_agentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    nickname TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL,
    skills TEXT DEFAULT '',
    avatar_url TEXT,
    estado_online BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Mensajes del Sistema
CREATE TABLE IF NOT EXISTS tj_mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canal TEXT NOT NULL DEFAULT '#general',
    remitente_tipo TEXT CHECK (remitente_tipo IN ('usuario', 'agente')),
    remitente_id UUID NOT NULL, -- UUID del agente o 0000... para usuario
    texto TEXT NOT NULL,
    estado_procesado BOOLEAN DEFAULT false,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar Realtime (CRITICO para ver mensajes al instante)
ALTER PUBLICATION supabase_realtime ADD TABLE tj_agentes;
ALTER PUBLICATION supabase_realtime ADD TABLE tj_mensajes;

-- 5. Insertar los 5 Agentes Iniciales
INSERT INTO tj_agentes (nombre, nickname, rol, skills, avatar_url)
VALUES 
('Senior Dev', 'Programador', 'Ingeniero de Software', 'React, Python, Supabase, n8n', 'https://api.dicebear.com/7.x/avataaars/svg?seed=code'),
('Marketing Pro', 'CommunityManager', 'Marketing y Contenido', 'Social Media, SEO, Copywriting', 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing'),
('Legal Expert', 'Legal', 'Consultoría Legal', 'Compliance, Contratos, Privacidad', 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal'),
('Data Analyst', 'Data', 'Análisis de Datos', 'SQL, Metabase, Predicción', 'https://api.dicebear.com/7.x/avataaars/svg?seed=data'),
('Project Manager', 'Strategist', 'Estrategia y QA', 'Planificación, Gestión de Equipos', 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy')
ON CONFLICT (nickname) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol,
    skills = EXCLUDED.skills;

-- 6. Políticas RLS (Seguridad Abierta para Desarrollo)
ALTER TABLE tj_agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tj_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total agentes" ON tj_agentes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total mensajes" ON tj_mensajes FOR ALL USING (true) WITH CHECK (true);

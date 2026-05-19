-- TJOffice Database Schema - v2 (Advanced Agent Management)

-- 1. Create Agentes Table with Skills
CREATE TABLE IF NOT EXISTS agentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    nickname TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL,
    skills TEXT DEFAULT '', 
    avatar_url TEXT,
    estado_online BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Mensajes Oficina Table
CREATE TABLE IF NOT EXISTS mensajes_oficina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canal TEXT NOT NULL DEFAULT '#general',
    remitente_tipo TEXT CHECK (remitente_tipo IN ('usuario', 'agente')),
    remitente_id UUID NOT NULL,
    texto TEXT NOT NULL,
    estado_procesado BOOLEAN DEFAULT false,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE agentes;
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes_oficina;

-- 4. Initial Advanced Agents
INSERT INTO agentes (nombre, nickname, rol, skills, avatar_url)
VALUES 
('Marketing Pro', 'CommunityManager', 'Marketing y Contenido', 'Social Media, SEO, Copywriting', 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing'),
('Senior Dev', 'Programador', 'Ingeniero de Software', 'React, Python, Supabase, n8n', 'https://api.dicebear.com/7.x/avataaars/svg?seed=code'),
('Legal Expert', 'Legal', 'Consultoría Legal', 'Compliance, Contratos, Privacidad', 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal'),
('Data Analyst', 'Data', 'Análisis de Datos', 'SQL, Metabase, Predicción', 'https://api.dicebear.com/7.x/avataaars/svg?seed=data'),
('Project Manager', 'Strategist', 'Estrategia y QA', 'Planificación, Gestión de Equipos', 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy')
ON CONFLICT (nickname) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol,
    skills = EXCLUDED.skills;

-- 5. RLS
ALTER TABLE agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_oficina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de agentes a todos" ON agentes FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de mensajes a todos" ON mensajes_oficina FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de mensajes a todos" ON mensajes_oficina FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de agentes a todos" ON agentes FOR UPDATE USING (true);

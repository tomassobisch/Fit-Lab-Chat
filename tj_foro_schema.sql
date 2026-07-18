-- SQL para crear la tabla de publicaciones del foro
-- Ejecuta esto en el SQL Editor de Supabase (https://supabase.com/)

CREATE TABLE IF NOT EXISTS tj_foro_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    autor_nombre TEXT NOT NULL,
    autor_rol TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE tj_foro_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total foro" ON tj_foro_posts FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Tiempo Real (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE tj_foro_posts;

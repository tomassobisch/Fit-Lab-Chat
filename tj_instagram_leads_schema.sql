-- Esquema de Base de Datos para el CRM de Instagram de TJ FITLAB
-- Ejecuta este script en el SQL Editor de Supabase si deseas sincronizar en la nube

CREATE TABLE IF NOT EXISTS tj_instagram_leads (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    instagram_user TEXT NOT NULL,
    telefono TEXT DEFAULT '',
    estado TEXT CHECK (estado IN ('nuevo', 'conversacion', 'agendado', 'cliente', 'frio')) DEFAULT 'nuevo',
    origen TEXT CHECK (origen IN ('Reel', 'Story', 'Bio Link', 'DM Directo', 'Anuncio Meta')) DEFAULT 'DM Directo',
    interes TEXT NOT NULL,
    valor_estimado NUMERIC DEFAULT 100,
    notas TEXT DEFAULT '',
    ultimo_contacto TIMESTAMPTZ DEFAULT now(),
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tj_instagram_leads;

-- Políticas RLS
ALTER TABLE tj_instagram_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total a leads de instagram" ON tj_instagram_leads FOR ALL USING (true) WITH CHECK (true);

-- Insertar prospectos iniciales de prueba
INSERT INTO tj_instagram_leads (id, nombre, instagram_user, telefono, estado, origen, interes, valor_estimado, notas)
VALUES 
('lead-1', 'Marcos Benítez', 'marcos_lift24', '+34 612 345 678', 'conversacion', 'Reel', 'Plan de Hipertrofia & Longevidad', 120, 'Comentó en el Reel de "Errores RIR 1-2". Quiere ganar masa muscular sin lesionarse la espalda.'),
('lead-2', 'Elena Domínguez', 'elena_crossfit', '+34 689 123 456', 'agendado', 'Story', 'TJ App Anual + HRV Tracking', 240, 'Llamada de diagnóstico agendada para el Lunes 18:00 CET. Usa Garmin y quiere sincronización.'),
('lead-3', 'Carlos Varela', 'carlosv_fit', '+34 655 789 012', 'cliente', 'Bio Link', 'Asesoría VIP 1 a 1', 180, 'Cliente cerrado. Suscripción activa desde el enlace del carrusel de Ozempic.'),
('lead-4', 'Sofía Navarro', 'sofia_running', '+34 670 998 877', 'nuevo', 'DM Directo', 'Entrenamiento Híbrido & HYROX', 95, 'Preguntó por DM sobre preparación para evento HYROX 2026. Pendiente de enviar audio.')
ON CONFLICT (id) DO NOTHING;

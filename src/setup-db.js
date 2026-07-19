import { createClient } from '@supabase/supabase-js';

// DATOS DEL PROYECTO DEL USUARIO
const supabaseUrl = 'https://ovbaukzafvrfymkmpdhh.supabase.co';
const supabaseKey = 'sb_publishable_0pFvPEWbBh7cWMb2KSFWwA_hudVfPrv'; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('--- INTENTANDO CONFIGURACIÓN DE BASE DE DATOS EN OVBAUKZAFVRFYMKMPDHH ---');

  // Intentamos primero insertar datos por si las tablas ya existen
  console.log('Insertando agentes especialistas...');
  const { data, error: err3 } = await supabase.from('tj_agentes').upsert([
    { nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: '/avatars/1.png' },
    { nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: '/avatars/2.png' },
    { nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: '/avatars/3.png' },
    { nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: '/avatars/4.png' },
    { nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: '/avatars/5.png' }
  ], { onConflict: 'nickname' });

  if (err3) {
    console.error('ERROR AL INSERTAR:', err3.message);
    console.log('\n--- DIAGNÓSTICO ---');
    if (err3.message.includes('relation "tj_agentes" does not exist')) {
      console.log('Las tablas no existen y la clave proporcionada no tiene permisos para crearlas automáticamente.');
    } else {
      console.log('Error de permisos o RLS activo.');
    }
    console.log('\n--- PASO OBLIGATORIO ---');
    console.log('Debes copiar el contenido de "tj-office-persistence.sql" y pegarlo en el SQL Editor de Supabase (URL: ovbaukzafvrfymkmpdhh).');
  } else {
    console.log('¡BASE DE DATOS CONFIGURADA Y AGENTES CARGADOS!');
  }
}

setupDatabase();

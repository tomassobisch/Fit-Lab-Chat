import fetch from 'node-fetch';

const apiKey = 'AIzaSyAc65yyCVGO3-RjMWMfejUUQRRqYQ6bGXA';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
  console.log('--- LISTANDO MODELOS DISPONIBLES ---');
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ ÉXITO: Conexión establecida.');
      console.log('Modelos encontrados:', data.models?.length || 0);
      data.models?.forEach(m => console.log(`- ${m.name}`));
    } else {
      console.error('❌ ERROR:', response.status);
      console.error('Detalle:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN:', err.message);
  }
}

listModels();

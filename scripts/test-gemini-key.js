import fetch from 'node-fetch';

const apiKey = 'AIzaSyAc65yyCVGO3-RjMWMfejUUQRRqYQ6bGXA';
// Probando con el modelo Flash 2.0 más reciente (experimental v1beta)
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

async function testKey() {
  console.log('--- DIAGNÓSTICO DE CLAVE GEMINI (gemini-2.0-flash-exp) ---');
  console.log('Enviando solicitud de prueba...');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Hola jefe, dime que el sistema pro está listo en 5 palabras.' }]
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ ÉXITO TOTAL: Tu clave PRO está activa con Gemini 2.0 Flash EXP.');
      console.log('Respuesta de la IA:', data.candidates[0].content.parts[0].text);
    } else {
      console.error('❌ ERROR:');
      console.error('Status:', response.status);
      console.error('Mensaje:', data.error?.message || 'Error desconocido');
    }
  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN:', err.message);
  }
}

testKey();

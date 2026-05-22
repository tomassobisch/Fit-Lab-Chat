import fetch from 'node-fetch';

const apiKey = 'AIzaSyAc65yyCVGO3-RjMWMfejUUQRRqYQ6bGXA';
// Probando con un modelo que acabamos de confirmar que existe en tu lista: gemini-2.0-flash
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

async function testKey() {
  console.log('--- DIAGNÓSTICO DE CLAVE GEMINI (gemini-2.0-flash) ---');
  console.log('Enviando solicitud de prueba...');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Hola jefe, dime que el sistema está listo en 5 palabras.' }]
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ ÉXITO TOTAL: Tu clave es válida y funcional.');
      console.log('Respuesta de la IA:', data.candidates[0].content.parts[0].text);
    } else {
      console.error('❌ ERROR EN EL MODELO ESPECÍFICO:');
      console.error('Status:', response.status);
      console.error('Mensaje:', data.error?.message || 'Error desconocido');
    }
  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN:', err.message);
  }
}

testKey();

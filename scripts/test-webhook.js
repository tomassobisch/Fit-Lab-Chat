import fetch from 'node-fetch';

const webhookUrl = 'http://localhost:5678/webhook-test/tj-mensajes-webhook';

async function testWebhook() {
  console.log('--- TEST DE DISPARO DE AUTOMATIZACIÓN ---');
  console.log(`Enviando señal a: ${webhookUrl}`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        texto: "MENSAJE DE PRUEBA DE SISTEMA",
        remitente: "MAIN_DIAGNOSTIC",
        canal: "#general",
        timestamp: new Date().toISOString()
      }),
    });

    if (response.ok) {
      console.log('✅ ÉXITO: n8n recibió la señal correctamente.');
      console.log('Status:', response.status);
    } else {
      console.error('❌ n8n RESPONDIÓ CON ERROR:');
      console.error('Status:', response.status);
      console.log('\nSugerencia: Asegúrate de que n8n tenga el botón "Listen for test event" activado en el nodo Webhook.');
    }
  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN CRÍTICO:');
    console.error('Mensaje:', err.message);
    console.log('\n--- POSIBLES CAUSAS ---');
    console.log('1. n8n NO está corriendo (ejecuta el comando Docker).');
    console.log('2. El firewall o antivirus está bloqueando el puerto 5678.');
    console.log('3. Estás probando desde la web (Vercel) y Vercel no puede ver tu localhost.');
  }
}

testWebhook();

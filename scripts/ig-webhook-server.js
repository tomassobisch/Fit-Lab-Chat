import http from 'http';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const PORT = process.env.PORT || 3000;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'TJ_FITLAB_IG_SECRET_TOKEN_2026';
const INSTAGRAM_PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
const CAL_URL = process.env.CAL_BOOKING_URL || 'https://cal.com/tjfitlab/evaluacion';

// Supabase client (using service role or anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Falta configurar Supabase URL o Key en .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// UUID del agente InstaMetrics Pro (@InstaAnalyst) en tj_agentes
const AGENT_INSTA_UUID = '9b51f99f-4408-46d0-a0ed-bd70803b7fab';

// Clasificación de intención y generación de respuesta directa
function resolverRespuesta(texto) {
  const t = texto.toLowerCase();

  // 1. Intención de agenda directa
  if (t.includes('agendar') || t.includes('llamada') || t.includes('turno') || t.includes('reunion') || t.includes('cita') || t.includes('calendario')) {
    return {
      respuesta: `¡Excelente! Coordinemos directamente tu llamada de 15 minutos en el calendario oficial: ${CAL_URL}`,
      status: 'enlace_enviado',
    };
  }

  // 2. Detección de modalidades
  if (t.includes('hibrid') || t.includes('hyrox') || t.includes('híbrido')) {
    return {
      respuesta: `Enfoque Híbrido anotado. Combinamos fuerza funcional con capacidad aeróbica. Agendemos una llamada corta para armar tu planificación: ${CAL_URL}`,
      modalidad: 'Híbrido',
      status: 'calificando',
    };
  }

  if (t.includes('correr') || t.includes('running') || t.includes('run') || t.includes('10k') || t.includes('maraton') || t.includes('maratón') || t.includes('media maraton')) {
    return {
      respuesta: `Enfoque Run anotado. Planificamos ritmos, volumen y prevención de sobrecargas. Reserva tu llamada de valoración aquí: ${CAL_URL}`,
      modalidad: 'Run',
      status: 'calificando',
    };
  }

  if (t.includes('fuerza') || t.includes('hipertrofia') || t.includes('pesas') || t.includes('masa') || t.includes('musculo') || t.includes('músculo')) {
    return {
      respuesta: `Enfoque de Fuerza anotado. Optimizamos sobrecarga progresiva y rendimiento muscular. Coordinemos la llamada para ver tu caso: ${CAL_URL}`,
      modalidad: 'Fuerza',
      status: 'calificando',
    };
  }

  // 3. Consulta de precios o planes
  if (t.includes('precio') || t.includes('plan') || t.includes('cuanto') || t.includes('cuánto') || t.includes('costo') || t.includes('tarifa') || t.includes('info') || t.includes('informacion') || t.includes('información')) {
    return {
      respuesta: `¡Buenas! En TJ Fitlab los planes son 100% individualizados según tus objetivos actuales y nivel. Agendemos una sesión rápida de 15 minutos para evaluar tu caso: ${CAL_URL}`,
      status: 'enlace_enviado',
    };
  }

  // 4. Saludo o calificación de entrada por defecto
  return {
    respuesta: '¡Buenas! Bienvenido a TJ Fitlab. Para orientarte de forma precisa: ¿tu foco actual de entrenamiento está en Fuerza, rendimiento Híbrido o Run?',
    status: 'calificando',
  };
}

// Envío a la API Graph de Meta
async function enviarMensajeDirecto(recipientId, texto) {
  const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`;

  console.log(`📤 [META_API] Enviando mensaje a destinatario ${recipientId}...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: texto },
    }),
  });

  const resJson = await res.json();
  if (!res.ok) {
    console.error('❌ [META_API_ERROR]:', resJson);
    throw new Error(`Graph API error: ${JSON.stringify(resJson)}`);
  }

  console.log(`✅ [META_API_SUCCESS] Mensaje enviado correctamente. ID: ${resJson.message_id || resJson.recipient_id}`);
  return resJson;
}

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // Ruta base / health check
  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      service: 'TJ Fitlab Instagram Webhook',
      timestamp: new Date().toISOString(),
    }));
  }

  // Rutas del webhook de Instagram (/api/webhooks/instagram o /api/webhooks/instagram/)
  if (pathname === '/api/webhooks/instagram' || pathname === '/api/webhooks/instagram/') {
    // 1. Handshake de verificación GET exigido por Meta
    if (req.method === 'GET') {
      const mode = reqUrl.searchParams.get('hub.mode');
      const token = reqUrl.searchParams.get('hub.verify_token');
      const challenge = reqUrl.searchParams.get('hub.challenge');

      console.log(`\n🔍 [META_HANDSHAKE] Recibida solicitud de verificación.`);
      console.log(`   Mode: ${mode} | Token: ${token} | Challenge: ${challenge}`);

      if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log(`✅ [META_HANDSHAKE] Verificación EXITOSA. Retornando challenge.`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(challenge);
      } else {
        console.warn(`❌ [META_HANDSHAKE] Token inválido o mode incorrecto.`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
      }
    }

    // 2. Recepción de mensajes en tiempo real POST
    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });

      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');

          // Responder 200 OK inmediatamente a Meta para evitar retries
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'received' }));

          console.log('\n📥 [WEBHOOK_POST] Payload recibido de Meta:', JSON.stringify(body, null, 2));

          if (body.object !== 'instagram' && body.object !== 'page') {
            console.log(`⚠️ Ignorado: objeto no soportado (${body.object})`);
            return;
          }

          const entry = body.entry?.[0];
          const messaging = entry?.messaging?.[0];

          // Descartar mensajes propios (eco) o payloads sin mensaje de texto
          if (!messaging || !messaging.message || messaging.message.is_echo) {
            console.log('ℹ️ Mensaje ignorado (es un eco propio o no contiene texto).');
            return;
          }

          const senderId = messaging.sender?.id;
          const messageText = messaging.message.text?.trim();

          if (!messageText || !senderId) {
            console.log('ℹ️ Payload sin texto o sin senderId.');
            return;
          }

          console.log(`\n📩 [MENSAJE_ENTRANTE] De: ${senderId} | Texto: "${messageText}"`);

          // A. Registrar o actualizar lead en ig_leads
          const { data: leadData, error: leadErr } = await supabase
            .from('ig_leads')
            .upsert(
              {
                instagram_id: senderId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'instagram_id' }
            )
            .select()
            .single();

          if (leadErr) {
            console.error('⚠️ Error al registrar lead en ig_leads:', leadErr.message);
          } else {
            console.log('✅ Lead registrado/actualizado en ig_leads:', leadData?.id);
          }

          // B. Persistir mensaje recibido en tj_mensajes
          const { error: msgErr } = await supabase.from('tj_mensajes').insert({
            canal: '#instagram',
            remitente_tipo: 'usuario',
            remitente_id: senderId,
            texto: messageText,
            estado_procesado: true,
          });

          if (msgErr) {
            console.error('⚠️ Error al insertar mensaje entrante en tj_mensajes:', msgErr.message);
          } else {
            console.log('✅ Mensaje entrante persistido en tj_mensajes');
          }

          // C. Determinar respuesta táctica y detectar modalidad
          const { respuesta, modalidad, status } = resolverRespuesta(messageText);

          // Actualizar modalidad y estatus si aplica
          const leadUpdate = { updated_at: new Date().toISOString() };
          if (modalidad) leadUpdate.modalidad_interes = modalidad;
          if (status) leadUpdate.status = status;

          await supabase
            .from('ig_leads')
            .update(leadUpdate)
            .eq('instagram_id', senderId);

          // D. Enviar mensaje de respuesta al usuario en Instagram
          let sendSuccess = false;
          try {
            await enviarMensajeDirecto(senderId, respuesta);
            sendSuccess = true;
          } catch (sendErr) {
            console.error('⚠️ Error al enviar mensaje vía Meta Graph API:', sendErr.message);
          }

          // E. Persistir mensaje saliente del bot en tj_mensajes (asignado a @InstaAnalyst)
          const { error: botMsgErr } = await supabase.from('tj_mensajes').insert({
            canal: '#instagram',
            remitente_tipo: 'agente',
            remitente_id: AGENT_INSTA_UUID,
            texto: respuesta,
            estado_procesado: true,
          });

          if (botMsgErr) {
            console.error('⚠️ Error al registrar respuesta del bot en tj_mensajes:', botMsgErr.message);
          } else {
            console.log(`✅ Respuesta del bot persistida en tj_mensajes con remitente @InstaAnalyst (Enviado a IG: ${sendSuccess ? 'SÍ' : 'NO'})\n`);
          }

        } catch (error) {
          console.error('❌ [IG_WEBHOOK_ERROR]:', error);
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 TJ FITLAB INSTAGRAM WEBHOOK ACTIVO EN PUERTO ${PORT}`);
  console.log(`🔗 URL Local: http://localhost:${PORT}/api/webhooks/instagram`);
  console.log(`🔐 Verify Token: ${META_VERIFY_TOKEN}`);
  console.log(`📅 Agenda Cal.com: ${CAL_URL}`);
  console.log('====================================================\n');
});

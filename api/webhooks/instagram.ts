import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'TJ_FITLAB_IG_SECRET_TOKEN_2026';
const INSTAGRAM_PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
const CAL_URL = process.env.CAL_BOOKING_URL || 'https://cal.com/tjfitlab/evaluacion';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);
const AGENT_INSTA_UUID = '9b51f99f-4408-46d0-a0ed-bd70803b7fab'; // @InstaAnalyst

function resolverRespuesta(texto: string) {
  const t = texto.toLowerCase();

  if (t.includes('agendar') || t.includes('llamada') || t.includes('turno') || t.includes('reunion') || t.includes('cita')) {
    return {
      respuesta: `¡Excelente! Coordinemos directamente tu llamada de 15 minutos en el calendario oficial: ${CAL_URL}`,
      status: 'enlace_enviado',
    };
  }

  if (t.includes('hibrid') || t.includes('hyrox') || t.includes('híbrido')) {
    return {
      respuesta: `Enfoque Híbrido anotado. Combinamos fuerza funcional con capacidad aeróbica. Agendemos una llamada corta para armar tu planificación: ${CAL_URL}`,
      modalidad: 'Híbrido',
      status: 'calificando',
    };
  }

  if (t.includes('correr') || t.includes('running') || t.includes('run') || t.includes('10k') || t.includes('maraton') || t.includes('maratón')) {
    return {
      respuesta: `Enfoque Run anotado. Planificamos ritmos, volumen y prevención de sobrecargas. Reserva tu llamada de valoración aquí: ${CAL_URL}`,
      modalidad: 'Run',
      status: 'calificando',
    };
  }

  if (t.includes('fuerza') || t.includes('hipertrofia') || t.includes('pesas') || t.includes('masa')) {
    return {
      respuesta: `Enfoque de Fuerza anotado. Optimizamos sobrecarga progresiva y rendimiento muscular. Coordinemos la llamada para ver tu caso: ${CAL_URL}`,
      modalidad: 'Fuerza',
      status: 'calificando',
    };
  }

  if (t.includes('precio') || t.includes('plan') || t.includes('cuanto') || t.includes('cuánto') || t.includes('costo') || t.includes('info')) {
    return {
      respuesta: `¡Buenas! En TJ Fitlab los planes son 100% individualizados según tus objetivos actuales y nivel. Agendemos una sesión rápida de 15 minutos para evaluar tu caso: ${CAL_URL}`,
      status: 'enlace_enviado',
    };
  }

  return {
    respuesta: '¡Buenas! Bienvenido a TJ Fitlab. Para orientarte de forma precisa: ¿tu foco actual de entrenamiento está en Fuerza, rendimiento Híbrido o Run?',
    status: 'calificando',
  };
}

async function enviarMensajeDirecto(recipientId: string, texto: string) {
  const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: texto },
    }),
  });

  if (!res.ok) {
    const errorDetails = await res.json();
    throw new Error(`Graph API error: ${JSON.stringify(errorDetails)}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Handshake GET
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // 2. Recepción POST
  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body?.object !== 'instagram' && body?.object !== 'page') {
        return res.status(200).json({ status: 'ignored' });
      }

      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (!messaging || !messaging.message || messaging.message.is_echo) {
        return res.status(200).json({ status: 'ignored' });
      }

      const senderId = messaging.sender?.id;
      const messageText = messaging.message.text?.trim();

      if (!messageText || !senderId) {
        return res.status(200).json({ status: 'no_text' });
      }

      // Persistir en Supabase
      await supabase.from('ig_leads').upsert(
        {
          instagram_id: senderId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'instagram_id' }
      );

      await supabase.from('tj_mensajes').insert({
        canal: '#instagram',
        remitente_tipo: 'usuario',
        remitente_id: senderId,
        texto: messageText,
        estado_procesado: true,
      });

      const { respuesta, modalidad, status } = resolverRespuesta(messageText);

      const leadUpdate: Record<string, string> = { updated_at: new Date().toISOString() };
      if (modalidad) leadUpdate.modalidad_interes = modalidad;
      if (status) leadUpdate.status = status;

      await supabase.from('ig_leads').update(leadUpdate).eq('instagram_id', senderId);

      // Enviar DM en Instagram
      try {
        await enviarMensajeDirecto(senderId, respuesta);
      } catch (err) {
        console.error('⚠️ [META_SEND_ERROR]:', err);
      }

      // Registrar respuesta saliente
      await supabase.from('tj_mensajes').insert({
        canal: '#instagram',
        remitente_tipo: 'agente',
        remitente_id: AGENT_INSTA_UUID,
        texto: respuesta,
        estado_procesado: true,
      });

      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('[IG_WEBHOOK_ERROR]:', error);
      return res.status(500).json({ error: 'Internal Error' });
    }
  }

  return res.status(405).send('Method Not Allowed');
}

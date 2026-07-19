import React, { useState, useEffect, useRef } from 'react';
import { Send, Edit3, Activity, MessageSquare, Settings2, X, Menu, RefreshCw, Search, Printer, PlusCircle, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, ReporteGym } from '../types';

interface ForumPost {
  id: string;
  titulo: string;
  autor_nombre: string;
  autor_rol: string;
  contenido: string;
  creado_en: string;
}

const INITIAL_AGENTS: Agente[] = [
  { id: '11111111-1111-1111-1111-111111111111', nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: '/avatars/1.png', estado_online: true, creado_en: '' },
  { id: '22222222-2222-2222-2222-222222222222', nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: '/avatars/2.png', estado_online: true, creado_en: '' },
  { id: '33333333-3333-3333-3333-333333333333', nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: '/avatars/3.png', estado_online: true, creado_en: '' },
  { id: '44444444-4444-4444-4444-444444444444', nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: '/avatars/4.png', estado_online: true, creado_en: '' },
  { id: '55555555-5555-5555-5555-555555555555', nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: '/avatars/5.png', estado_online: true, creado_en: '' }
];

const INITIAL_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    titulo: 'Ozempic y la Masa Muscular: Oportunidad de Fuerza Sarcopénica',
    autor_nombre: 'Data Analyst (Data)',
    autor_rol: 'Análisis de Datos',
    contenido: 'De acuerdo con el estudio de tendencias 2026, el auge de los fármacos GLP-1 (Ozempic/Wegovy) está provocando una pérdida masiva de masa magra en los usuarios. TJ FITLAB debería lanzar un programa específico llamado **"GLP-1 Muscle Companion"** con foco en entrenamiento de fuerza pesado y alta ingesta proteica. Las estadísticas muestran que este subnicho está desatendido y tiene un valor de mercado que crece al 26% anual.',
    creado_en: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'post-2',
    titulo: 'Integración de Wearables (Whoop, Garmin, Apple Watch) en TJ App',
    autor_nombre: 'Senior Dev (Programador)',
    autor_rol: 'Ingeniero de Software',
    contenido: 'He estado revisando la API de Garmin Connect y Whoop. Podemos integrar los datos de HRV (Variabilidad de la Frecuencia Cardíaca) y sueño en nuestra base de datos. De esta forma, la app podrá ajustar automáticamente el volumen de series y la intensidad (RPE) en base a la fatiga biológica real del usuario en lugar de seguir un plan fijo.',
    creado_en: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'post-3',
    titulo: 'Estrategia TikTok: Casos de Estudio Data-Driven',
    autor_nombre: 'Marketing Pro (CommunityManager)',
    autor_rol: 'Marketing y Contenido',
    contenido: 'Debemos dejar de publicar videos genéricos de ejercicios. El formato que mejor engagement está teniendo en la Gen Z es el **"Data-Driven Storytelling"**: mostrar cómo bajó la frecuencia cardíaca en reposo de un cliente real o cómo aumentó su VO2 Max, usando capturas y gráficos de nuestra propia app. Esto genera 3x más confianza y engagement.',
    creado_en: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

const MOCK_REPORTE: ReporteGym = {
    id: 'mock',
    total_alumnos: 148,
    mensajes_pendientes: 8,
    pendientes_escaneo: ['JAVIER M.', 'SOFÍA R.'],
    sin_respuesta: [],
    lista_alumnos: [
      'ALUMNO EJEMPLO', 'ATLETA SIMULADO', 'carlos carol', 'CATALINA G.', 'DAVID PRUEBA 3',
      'JAVIER M.', 'JULIÁN ONZAGA', 'Lluis Alcala', 'Luis ', 'MARCOS PRUEBA 1',
      'RUBEN PRO MAX', 'SARA PRUEBA 2', 'SOFÍA R.', 'PRUEBA FINAL_ADMISION'
    ],
    creado_en: new Date().toISOString()
};

const extractUrls = (text: string): string[] => {
  const regex = /(https?:\/\/[^\s\)\*\_\]\[\>]+)/g;
  const matches = text.match(regex) || [];
  return Array.from(new Set(matches)).filter(url => {
    return !url.includes('dicebear.com') && 
           !url.match(/\.(png|jpg|jpeg|gif|svg)$/i) &&
           !url.endsWith(')');
  });
};

const extractStats = (text: string): string[] => {
  const lines = text.split('\n');
  const stats: string[] = [];
  
  for (const line of lines) {
    const cleanLine = line.replace(/^[\s*\-\+]+/, '').trim();
    if (cleanLine.length > 10 && cleanLine.length < 150) {
      if (
        cleanLine.includes('%') || 
        /\b\d{4,9}\b/.test(cleanLine) || 
        cleanLine.toLowerCase().includes('millones') ||
        cleanLine.toLowerCase().includes('estadísticas') ||
        cleanLine.toLowerCase().includes('crecimiento de')
      ) {
        if (!cleanLine.includes('http://') && !cleanLine.includes('https://')) {
          stats.push(cleanLine);
        }
      }
    }
    if (stats.length >= 4) break;
  }
  return stats;
};

export const TJOfficeChat: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>(INITIAL_AGENTS);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [ultimoReporte, setUltimoReporte] = useState<ReporteGym>(MOCK_REPORTE);
  const [studentSearch, setStudentSearch] = useState('');
  const [inputText, setInputText] = useState('');
  const [isAutoActive, setIsAutoActive] = useState(true);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // VISTA ACTIVA: CHAT O FORO DE TENDENCIAS
  const [activeView, setActiveView] = useState<'chat' | 'forum'>('chat');
  const [forumActiveTab, setForumActiveTab] = useState<'trends' | 'proposal' | 'discussion'>('trends');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [reportSearch, setReportSearch] = useState<string>('');
  
  // HILO DE DISCUSIÓN / PUBLICACIONES
  const [forumPosts, setForumPosts] = useState<ForumPost[]>(() => {
    const saved = localStorage.getItem('tj_forum_posts');
    return saved ? JSON.parse(saved) : INITIAL_FORUM_POSTS;
  });
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);

  // MODAL CREAR PUBLICACIÓN
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostAuthor, setNewPostAuthor] = useState('');

  // NUEVOS ESTADOS PARA INVESTIGACIÓN Y RONDAS
  const [isResearching, setIsResearching] = useState(false);
  const [researchTopic, setResearchTopic] = useState('');
  const [researchAgent, setResearchAgent] = useState<string>('all');
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [researchStatus, setResearchStatus] = useState<string>('');
  const [researchProgress, setResearchProgress] = useState<number>(0);

  // AUTOCOMPLETE MENCIONES (@)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ESTADO PARA MOSTRAR PERFIL DETALLADO DE AGENTES/JEFE
  const [profileToShow, setProfileToShow] = useState<{
    nombre: string;
    nickname: string;
    rol: string;
    avatar_url: string;
    skills: string;
    cualidades: string;
    dedicacion: string;
    suma: string;
  } | null>(null);

  const handleOpenProfile = (agent: Agente) => {
    let cualidades = '';
    let dedicacion = '';
    let suma = '';

    switch (agent.nickname.toLowerCase()) {
      case 'programador':
        cualidades = 'Lógica implacable, velocidad de desarrollo extrema, resolutivo frente a bugs complejos y orientado a rendimiento de sistemas.';
        dedicacion = 'Diseña e implementa el código base del ecosistema, integraciones de IA (Gemini API), automatizaciones con n8n y persistencia en bases de datos.';
        suma = 'Acelera la entrega de nuevas características, garantiza que la app escale y funcione en producción sin caídas, y automatiza procesos internos del equipo.';
        break;
      case 'communitymanager':
        cualidades = 'Empatía con el usuario, creatividad visual desbordante, gran redacción persuasiva y analítica de conversión.';
        dedicacion = 'Analiza las redes sociales del sector fitness, gestiona la comunicación corporativa, planifica campañas de captación y redacta posts informativos de alta conversión.';
        suma = 'Atrae nuevos prospectos calificados, mejora el posicionamiento orgánico en Google de TJ FITLAB y crea una comunidad fiel y activa alrededor del fitness y la salud.';
        break;
      case 'legal':
        cualidades = 'Precisión analítica absoluta, previsión de riesgos regulatorios, ética profesional intachable y redacción minuciosa.';
        dedicacion = 'Vela por el cumplimiento de las normativas legales, redacta políticas de privacidad para la app, diseña los contratos de proveedores/colaboradores y previene litigios.';
        suma = 'Protege legalmente a TJ FITLAB contra reclamaciones o multas millonarias de datos, y proporciona una base regulatoria segura para todas las operaciones y servicios digitales.';
        break;
      case 'data':
        cualidades = 'Pensamiento analítico profundo, objetividad matemática, habilidad para encontrar patrones invisibles en masas de datos.';
        dedicacion = 'Monitoriza el comportamiento de los usuarios en la app, analiza estadísticas de uso, genera previsiones de negocio y reporta métricas clave de retención y conversión.';
        suma = 'Permite tomar decisiones de negocio basadas en datos reales y no en intuiciones, optimizando las tarifas, los programas de entrenamiento y la retención de clientes.';
        break;
      case 'strategist':
        cualidades = 'Visión holística, liderazgo organizativo, perfeccionista con la calidad del producto y excelente mediador.';
        dedicacion = 'Coordina los sprints de desarrollo, planifica las fases del proyecto, valida la calidad de las entregas antes del lanzamiento y diseña la estrategia competitiva de FITLAB.';
        suma = 'Evita cuellos de botella en el equipo, asegura que el producto se entregue a tiempo con calidad prémium y alinea los objetivos del software con la visión comercial de la empresa.';
        break;
      case 'tecnico deportivo':
      case 'tecnico deportivo.':
        cualidades = 'Pasión por el rendimiento físico, precisión metodológica en entrenamientos, analítico y práctico.';
        dedicacion = 'Diseña rutinas físicas basadas en ciencia, realiza raspado de datos deportivos (scraping) de competidores y configura alertas de rendimiento.';
        suma = 'Proporciona el sustento metodológico y científico del entrenamiento físico de FITLAB, aportando valor técnico inmediato a los usuarios.';
        break;
      case 'auditor deportivo data':
      case 'auditor fitness':
        cualidades = 'Disciplina absoluta, atención minuciosa al detalle, rigor analítico y excelente control de métricas.';
        dedicacion = 'Realiza auditorías de rendimiento del software y de la calidad del servicio de asesoría física, asegurando el cumplimiento de los estándares establecidos.';
        suma = 'Garantiza la máxima calidad y seguridad en las asesorías deportivas, evitando errores de planificación física y optimizando los procesos de mensajería interna.';
        break;
      default:
        cualidades = 'Especialista proactivo enfocado en el crecimiento y optimización deportiva.';
        dedicacion = 'Aporta conocimientos de su área específica de deportes y salud para la mejora técnica.';
        suma = 'Enriquece el criterio del equipo y aporta valor científico al ecosistema de TJ FITLAB.';
    }

    setProfileToShow({
      nombre: agent.nombre,
      nickname: agent.nickname,
      rol: agent.rol,
      avatar_url: agent.avatar_url,
      skills: agent.skills,
      cualidades,
      dedicacion,
      suma
    });
  };

  const handleOpenJefeProfile = () => {
    setProfileToShow({
      nombre: 'Administrador General',
      nickname: 'Jefe',
      rol: 'CEO y Director General',
      avatar_url: '/avatars/jefe.png',
      skills: 'Liderazgo Estratégico, Toma de Decisiones, Finanzas, Negociación, Visión de Negocio',
      cualidades: 'Visión de futuro, capacidad de inspirar al equipo, toma de decisiones rápidas y asertivas bajo presión.',
      dedicacion: 'Dirige el rumbo comercial de la empresa, aprueba las iniciativas estratégicas propuestas por los agentes, gestiona los recursos clave y lidera la expansión del ecosistema FITLAB.',
      suma: 'Es el motor y la visión detrás de la compañía, alinea los objetivos del software con la visión comercial para liderar el sector fitness.'
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtOffset = textBeforeCursor.lastIndexOf('@');

    if (lastAtOffset !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtOffset + 1);
      if (!textAfterAt.includes(' ')) {
        setShowMentionSuggestions(true);
        setMentionFilter(textAfterAt);
        return;
      }
    }
    
    setShowMentionSuggestions(false);
  };

  const handleSelectMention = (nickname: string) => {
    const selectionStart = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = inputText.slice(0, selectionStart);
    const lastAtOffset = textBeforeCursor.lastIndexOf('@');

    if (lastAtOffset !== -1) {
      const beforeAt = inputText.slice(0, lastAtOffset);
      const afterCursor = inputText.slice(selectionStart);
      const newValue = `${beforeAt}@${nickname} ${afterCursor}`;
      setInputText(newValue);
      setShowMentionSuggestions(false);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newPos = lastAtOffset + nickname.length + 2;
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  const filteredSuggestions = agentes.filter(a => 
    a.nickname.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    a.rol.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const speakMessage = (text: string, nickname: string) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/@\w+/g, '').trim());
      utterance.lang = 'es-ES';
      if (nickname === 'Programador') utterance.pitch = 0.8;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
      if (a?.length) setAgentes(a);
      
      const { data: m } = await supabase.from('tj_mensajes').select('*').order('creado_en', { ascending: false }).limit(50);
      if (m) setMensajes(m.reverse());
      
      const { data: r } = await supabase.from('tj_reportes').select('*').order('creado_en', { ascending: false }).limit(1);
      if (r?.[0]) setUltimoReporte(r[0]);

      // NUEVO: Intentar cargar posts del foro desde Supabase
      const { data: f, error: fErr } = await supabase.from('tj_foro_posts').select('*').order('creado_en', { ascending: false });
      if (!fErr && f && f.length > 0) {
        setForumPosts(f);
      }
    } catch (err) { console.warn("DB offline, using mock data"); }
    finally { setIsSyncing(false); }
  };

  const executeSingleAgentResearch = async (agent: Agente, customTopic?: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert("No se detectó VITE_GEMINI_API_KEY en las variables de entorno. Por favor, configúrala en tu archivo .env para realizar búsquedas reales.");
      return;
    }

    setIsTyping(agent.nickname);
    
    // Configurar tema y pregunta
    let nicho = '';
    let subnicho = '';
    let pregunta = '';
    
    if (customTopic && customTopic.trim()) {
      const topicClean = customTopic.trim();
      if (agent.nickname === 'Programador') {
        nicho = 'Tecnología y Monitoreo';
        subnicho = `Monitoreo digital y tracking para: ${topicClean} en 2026`;
        pregunta = `Investiga sobre wearables, apps móviles y sensores de bio-tracking que estén monitoreando el impacto de: ${topicClean} en 2026. Proporciona estadísticas de adopción, enlaces reales a estudios o webs de marcas del sector y recomendaciones prácticas para TJ FITLAB.`;
      } else if (agent.nickname === 'CommunityManager') {
        nicho = 'Marketing y Redes Sociales';
        subnicho = `Tendencias en redes y contenido sobre: ${topicClean} en 2026`;
        pregunta = `Investiga qué sub-nichos de creadores, hashtags y formatos están dominando en TikTok e Instagram con respecto a: ${topicClean} en 2026. Queremos estadísticas de crecimiento, enlaces a tendencias sociales y formatos de video recomendados para TJ FITLAB.`;
      } else if (agent.nickname === 'Legal') {
        nicho = 'Salud, Regulación y Seguridad';
        subnicho = `Normativas y legalidad de: ${topicClean} en 2026`;
        pregunta = `Investiga la regulación legal actual, normativas de salud y aspectos de privacidad aplicables en 2026 a: ${topicClean}. Proporciona estadísticas de cumplimiento de normas, enlaces a agencias oficiales y directrices para entrenadores de TJ FITLAB.`;
      } else if (agent.nickname === 'Data') {
        nicho = 'Análisis de Mercado y Datos';
        subnicho = `Estudios científicos y cuotas de mercado sobre: ${topicClean} en 2026`;
        pregunta = `Investiga estadísticas cuantitativas, cifras de consumo del mercado y estudios clínicos recientes de 2026 sobre: ${topicClean}. Queremos porcentajes clave de beneficio y enlaces a fuentes académicas o de mercado.`;
      } else if (agent.nickname === 'Strategist') {
        nicho = 'Operaciones y Nuevos Programas';
        subnicho = `Modelos de negocio e integración comercial de: ${topicClean} en 2026`;
        pregunta = `Investiga cómo los centros boutique y coaches premium están integrando programas específicos de: ${topicClean} en 2026. Aporta datos sobre el ticket promedio de estos servicios y recomendaciones operativas para TJ FITLAB.`;
      } else {
        nicho = 'Tendencias Generales';
        subnicho = `Análisis de: ${topicClean} en 2026`;
        pregunta = `Investiga las principales tendencias, datos de mercado y referencias científicas recientes de 2026 sobre: ${topicClean}. Proporciona estadísticas claras y enlaces a fuentes.`;
      }
    } else {
      // Usar temas por defecto
      const defaultTopics: Record<string, { nicho: string; subnicho: string; pregunta: string }> = {
        'Programador': {
          nicho: 'Tecnología en Gimnasios',
          subnicho: 'Wearables, sensores de rendimiento en tiempo real y conectividad en 2026',
          pregunta: 'Investiga las últimas tecnologías de wearables de fitness, anillos inteligentes y sensores IoT en máquinas de gimnasio para este año 2026. Queremos estadísticas de adopción, enlaces reales de referencia a sitios como Garmin, Whoop u otros y recomendaciones prácticas.'
        },
        'CommunityManager': {
          nicho: 'Marketing y Redes Sociales de Fitness',
          subnicho: 'Influencers, desafíos interactivos y sub-nichos virales en Instagram/TikTok en 2026',
          pregunta: 'Investiga qué sub-nichos de entrenamiento están dominando en TikTok e Instagram esta semana en 2026. Queremos estadísticas de crecimiento, enlaces de referencia a tendencias en redes sociales y qué tipo de contenido multimedia atrae más.'
        },
        'Legal': {
          nicho: 'Salud, Regulación y Longevidad',
          subnicho: 'Normativas de suplementos de antienvejecimiento, péptidos y privacidad de datos de salud en 2026',
          pregunta: 'Investiga las regulaciones y tendencias legales vigentes en 2026 sobre el uso de suplementos de longevidad en gimnasios y la protección de datos biométricos recopilados por apps de fitness. Proporciona estadísticas de cumplimiento y enlaces a fuentes.'
        },
        'Data': {
          nicho: 'Análisis de Mercado Fitness',
          subnicho: 'Pilates Reformer tecnológico y el fenómeno global de HYROX en 2026',
          pregunta: 'Investiga estadísticas cuantitativas actualizadas sobre el crecimiento y cuotas de mercado del Pilates Reformer inteligente y las competiciones híbridas tipo HYROX en 2026. Cifras de negocio globales y enlaces de referencia.'
        },
        'Strategist': {
          nicho: 'Operación y Modelos Híbridos',
          subnicho: 'Gimnasios boutique híbridos y entrenamiento grupal de fuerza enfocado en longevidad en 2026',
          pregunta: 'Investiga el auge de los gimnasios boutique que combinan entrenamiento outdoor e indoor, y el entrenamiento de fuerza grupal centrado en Zone 2 y longevidad en 2026. Estadísticas operativas y enlaces de referencia.'
        }
      };
      const info = defaultTopics[agent.nickname] || {
        nicho: 'Tendencias Generales del Fitness',
        subnicho: 'Fitness regenerativo y entrenamiento funcional en 2026',
        pregunta: 'Investiga las principales tendencias de fitness regenerativo, crioterapia, saunas de infrarrojos y recuperación activa en 2026. Estadísticas de crecimiento y enlaces de referencia.'
      };
      nicho = info.nicho;
      subnicho = info.subnicho;
      pregunta = info.pregunta;
    }

    const promptText = `Eres ${agent.nombre} (rol: ${agent.rol}). 
Tienes acceso a buscar en internet en tiempo real a través de Google Search. Utilízalo siempre para obtener datos reales, estadísticas y enlaces sobre: ${pregunta}.
SIEMPRE di "¡Hola jefe!" al inicio de tu respuesta en el chat.

Debes redactar una investigación exhaustiva y detallada de al menos 600 palabras sobre esta tendencia de 2026 para publicarla en el foro.
Para publicarla, añade al final de tu respuesta EXACTAMENTE esta estructura estructurada en etiquetas de texto plano (NO uses formato JSON para evitar errores de sintaxis):

[PUBLISH_TITLE]: Título corto y llamativo de la tendencia de investigación
[PUBLISH_CONTENT]:
# Análisis de la Tendencia: [Nombre de la tendencia]

## 1. Resumen de la Investigación
(Escribe una explicación detallada de al menos 250 palabras explicando el fenómeno, por qué es tendencia en 2026 y su contexto).

## 2. Estadísticas Clave e Impacto Cuantitativo
(Aporta al menos 3 estadísticas con porcentajes, cuotas de mercado o cifras de negocio reales de tu búsqueda en internet para 2026).

## 3. Enlaces y Fuentes de Referencia
(Es CRÍTICO que incluyas una lista de URLs reales, completas y activas a los sitios web oficiales que consultaste durante tu búsqueda en Google Search, por ejemplo de Garmin, Whoop, ClassPass, ACSM, PubMed u otras fuentes de noticias/estudios. Formato: - [Nombre del Sitio](https://URL_REAL)).

## 4. Aplicación Estratégica en TJ FITLAB
(Escribe recomendaciones específicas de cómo TJ FITLAB puede capitalizar esta oportunidad en su app, servicios o marketing).

Responde al usuario.`;

    let aiText = '';
    let publishData: { titulo: string; contenido: string } | null = null;

    try {
      // Llamada API con Google Search
      let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }],
          tools: [{ google_search: {} }] 
        })
      });
      
      if (!res.ok) {
        // Fallback a gemini-2.0-flash
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: promptText }] }],
            tools: [{ google_search: {} }]
          })
        });
      }

      if (!res.ok) {
        // Fallback sin herramientas
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: promptText }] }]
          })
        });
      }

      const resJson = await res.json();
      if (res.ok && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
        aiText = resJson.candidates[0].content.parts[0].text;
      } else {
        const errMsg = resJson.error?.message || "Error desconocido en Gemini";
        throw new Error(errMsg);
      }
    } catch (e: any) {
      console.error("Fallo llamada Gemini en investigación:", e);
      aiText = `¡Hola jefe! He intentado buscar información sobre "${nicho}" en internet, pero encontré un error al consultar el sistema de IA: ${e.message}`;
    }

    // Procesar e insertar post
    // 1. Intentar con formato plano (TITLE/CONTENT)
    const titlePlainMatch = aiText.match(/\[PUBLISH_TITLE\]:\s*(.*?)(?=\n|\[PUBLISH_CONTENT\]|$)/i);
    const contentPlainMatch = aiText.match(/\[PUBLISH_CONTENT\]:\s*([\s\S]*)/i);
    
    if (titlePlainMatch && contentPlainMatch) {
      publishData = {
        titulo: titlePlainMatch[1].trim(),
        contenido: contentPlainMatch[1].trim()
      };
      
      // Limpiar aiText de los bloques de publicación para la respuesta del chat
      aiText = aiText.replace(/\[PUBLISH_TITLE\]:[\s\S]*?\[PUBLISH_CONTENT\]:/gi, '')
                     .replace(contentPlainMatch[0], '')
                     .trim();
      if (!aiText) {
        aiText = `¡Hola jefe! He completado mi investigación sobre la tendencia de "${nicho}" y he publicado el informe en el foro.`;
      }
    } else {
      // 2. Intentar con formato JSON heredado
      const publishRegex = /\[PUBLISH_POST\]:\s*(\{.*\})/is;
      const match = aiText.match(publishRegex);
      
      if (match) {
        try {
          publishData = JSON.parse(match[1]);
          aiText = aiText.replace(publishRegex, '').trim();
        } catch (jsonErr) {
          const titleMatch = match[1].match(/"titulo"\s*:\s*"([\s\S]*?)"\s*(?:,|\n|\})/i);
          const contentMatch = match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*$/is) || 
                               match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*\}\s*$/is) ||
                               match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*(?:\}\s*)?$/is);
          
          if (titleMatch && contentMatch) {
            publishData = {
              titulo: titleMatch[1].trim(),
              contenido: contentMatch[1].replace(/\\n/g, '\n').trim()
            };
            aiText = aiText.replace(publishRegex, '').trim();
          }
        }
      } else {
        // Fallback: si no detectó etiquetas pero generó buen texto
        if (!aiText.startsWith("¡Hola jefe! He intentado")) {
          const cleanContent = aiText.replace(/\[PUBLISH_POST\]:?/gi, '').trim();
          publishData = {
            titulo: `Investigación: ${nicho} (${agent.nombre})`,
            contenido: cleanContent
          };
        }
      }
    }

    // Insertar chat message informando al jefe
    const statusMsgText = publishData 
      ? `¡Hola jefe! He completado mi investigación en internet sobre **"${nicho}"** (${subnicho}). He publicado el artículo de tendencias titulado: **"${publishData.titulo}"** en el foro de discusión con enlaces reales y estadísticas de 2026.`
      : aiText;

    try {
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'agente',
        remitente_id: agent.id,
        texto: statusMsgText,
        canal: '#general'
      }]);
    } catch(err){}

    if (publishData) {
      const newPost = {
        titulo: publishData.titulo,
        autor_nombre: `${agent.nombre} (@${agent.nickname})`,
        autor_rol: agent.rol,
        contenido: publishData.contenido
      };

      try {
        const { data: inserted, error: insErr } = await supabase.from('tj_foro_posts').insert([newPost]).select();
        if (insErr) {
          const localPost: ForumPost = {
            id: `post-${Date.now()}`,
            ...newPost,
            creado_en: new Date().toISOString()
          };
          setForumPosts(prev => [localPost, ...prev]);
        } else if (inserted && inserted[0]) {
          setForumPosts(prev => [inserted[0], ...prev]);
        }
      } catch (dbErr) {
        const localPost: ForumPost = {
          id: `post-${Date.now()}`,
          ...newPost,
          creado_en: new Date().toISOString()
        };
        setForumPosts(prev => [localPost, ...prev]);
      }
    }

    setIsTyping(null);
  };

  const runAllAgentsResearchRound = async () => {
    if (isResearching) return;
    setIsResearching(true);
    setResearchProgress(0);
    
    const topicDisplay = researchTopic.trim() ? `"${researchTopic.trim()}"` : 'temas asignados por especialidad';
    
    if (researchAgent === 'all') {
      setResearchStatus('Inicializando la ronda de agentes...');
      try {
        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'usuario',
          remitente_id: '00000000-0000-0000-0000-000000000000',
          texto: `[SISTEMA]: Iniciando Ronda de Investigación y Publicación de Foros. Los agentes buscarán en internet sobre ${topicDisplay} en 2026.`,
          canal: '#general'
        }]);
      } catch(e){}

      for (let i = 0; i < agentes.length; i++) {
        const agent = agentes[i];
        const prog = Math.round((i / agentes.length) * 100);
        setResearchProgress(prog);
        setResearchStatus(`Investigando: @${agent.nickname} (${agent.rol}) buscando en internet...`);
        
        try {
          await executeSingleAgentResearch(agent, researchTopic);
        } catch (err: any) {
          console.error(`Error en investigación de @${agent.nickname}:`, err);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      const selectedAg = agentes.find(a => a.id === researchAgent || a.nickname === researchAgent);
      if (selectedAg) {
        setResearchStatus(`Investigando: @${selectedAg.nickname} (${selectedAg.rol}) buscando en internet...`);
        try {
          await supabase.from('tj_mensajes').insert([{
            remitente_tipo: 'usuario',
            remitente_id: '00000000-0000-0000-0000-000000000000',
            texto: `[SISTEMA]: @${selectedAg.nickname} inicia investigación en internet sobre ${topicDisplay}.`,
            canal: '#general'
          }]);
        } catch(e){}

        try {
          await executeSingleAgentResearch(selectedAg, researchTopic);
        } catch (err: any) {
          console.error(`Error en investigación de @${selectedAg.nickname}:`, err);
        }
      }
    }

    setResearchProgress(100);
    setResearchStatus('¡Investigación finalizada!');
    
    try {
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: `[SISTEMA]: Investigación finalizada. Nuevos datos publicados en el Foro.`,
        canal: '#general'
      }]);
    } catch(e){}

    setTimeout(() => {
      setIsResearching(false);
      setShowResearchModal(false);
      setResearchTopic('');
      setResearchAgent('all');
      fetchData(); // Recargar todo
    }, 2000);
  };

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('ultra-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tj_mensajes' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tj_foro_posts' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (scrollRef.current && activeView === 'chat') {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensajes, activeView]);

  // Cargar Markdown de los informes
  useEffect(() => {
    if (activeView === 'forum') {
      const loadFile = async () => {
        try {
          const path = forumActiveTab === 'trends' ? '/fitness_trends_study_2026.md' : '/tj_fitlab_proposal_adaptation.md';
          const res = await fetch(path);
          if (!res.ok) throw new Error('File not found');
          const text = await res.text();
          setReportMarkdown(text);
        } catch (e) {
          setReportMarkdown('Error al cargar el archivo de informe.');
        }
      };
      loadFile();
    }
  }, [forumActiveTab, activeView]);

  // Guardar posts del foro
  useEffect(() => {
    localStorage.setItem('tj_forum_posts', JSON.stringify(forumPosts));
  }, [forumPosts]);

  // Re-iniciar Mermaid al cambiar el HTML renderizado
  useEffect(() => {
    if (activeView === 'forum' && forumActiveTab !== 'discussion') {
      const timer = setTimeout(() => {
        const mermaidElements = document.querySelectorAll('.mermaid-block');
        const mermaid = (window as any).mermaid;
        if (mermaidElements.length && mermaid) {
          try {
            mermaid.init(undefined, mermaidElements);
          } catch (e) {
            console.error("Mermaid React Init Error:", e);
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [reportMarkdown, forumActiveTab, activeView]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userText = inputText;
    setInputText('');
    setIsSending(true);

    setTimeout(() => setIsSending(false), 5000);

    try {
      const { data } = await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario', remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: userText, canal: '#general'
      }]).select();

      if (data?.[0]) setMensajes(prev => [...prev, data[0] as Mensaje]);

      // Detectar si se menciona a algún agente en particular (ej: @Programador)
      const mentionRegex = /@([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_.]+)/i;
      const mentionMatch = userText.match(mentionRegex);
      let agentToReply = null;
      
      if (mentionMatch) {
        let nick = mentionMatch[1].toLowerCase();
        // Limpiar puntuación común del final del nickname si aplica
        if (nick.endsWith('.') && nick !== 'tecnico deportivo.') {
          nick = nick.slice(0, -1);
        }
        agentToReply = agentes.find(a => a.nickname.toLowerCase() === nick);
      }

      // Siempre responder al mensaje del usuario (si hay mención responde el mencionado, si no uno aleatorio)
      const agent = agentToReply || agentes[Math.floor(Math.random() * agentes.length)] || agentes[0];
      if (agent) {
        setIsTyping(agent.nickname);
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        let aiText = "";
        let publishData: { titulo: string; contenido: string } | null = null;

        if (!apiKey) {
           aiText = "¡Hola jefe! Recibido y procesando. (Aviso: No se detectó la clave VITE_GEMINI_API_KEY en las variables de entorno, por lo que el agente está respondiendo en modo local simulado. Por favor, asegúrate de configurar tu archivo .env y reiniciar el servidor de desarrollo).";
        } else {
            const promptText = `Eres ${agent.nombre} (rol: ${agent.rol}). 
Tienes acceso a buscar en internet en tiempo real a través de Google Search. Utilízalo siempre que te pregunten sobre datos actuales, noticias, tendencias o estadísticas del fitness en 2026.
SIEMPRE di "¡Hola jefe!" al inicio de tu respuesta.

Si encuentras una tendencia importante de fitness, noticias o estudios científicos recientes, o una oportunidad de negocio/mejora relevante para TJ FITLAB y quieres publicarla en el foro del equipo, debes añadir al final de tu respuesta EXACTAMENTE esta estructura estructurada en etiquetas de texto plano (NO uses formato JSON):

[PUBLISH_TITLE]: Título de la tendencia
[PUBLISH_CONTENT]:
# Análisis de la Tendencia: [Nombre de la tendencia]

## 1. Resumen de la Investigación
(Escribe una explicación detallada de al menos 250 palabras explicando el fenómeno y su contexto en 2026).

## 2. Estadísticas Clave e Impacto
(Aporta al menos 3 estadísticas con porcentajes o números reales sobre la tendencia para 2026).

## 3. Enlaces y Fuentes de Referencia
(Es CRÍTICO que incluyas una lista de URLs reales, completas y activas a los sitios web oficiales que consultaste en tu búsqueda, por ejemplo: - [Nombre del Sitio](https://URL_REAL)).

## 4. Aplicación Estratégica en TJ FITLAB
(Escribe recomendaciones específicas de cómo TJ FITLAB puede capitalizar esta oportunidad en su app, servicios o marketing).

Responde al usuario: ${userText}`;

            try {
              // Intento 1: v1beta con gemini-2.5-flash y google_search
              let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  contents: [{ parts: [{ text: promptText }] }],
                  tools: [{ google_search: {} }] 
                })
              });
              
              // Intento 2: fallback a gemini-2.0-flash si la anterior falla
              if (!res.ok) {
                console.warn("Fallo con gemini-2.5-flash, intentando con gemini-2.0-flash...");
                res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    contents: [{ parts: [{ text: promptText }] }],
                    tools: [{ google_search: {} }]
                  })
                });
              }
              
              // Intento 3: fallback sin herramientas si sigue fallando
              if (!res.ok) {
                console.warn("Fallo con herramientas, ejecutando llamada simple...");
                res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    contents: [{ parts: [{ text: promptText }] }]
                  })
                });
              }
              
              const resJson = await res.json();
              if (res.ok && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                 aiText = resJson.candidates[0].content.parts[0].text;
              } else {
                 console.error("Gemini API Error details:", resJson);
                 const errMsg = resJson.error?.message || "Error desconocido";
                 aiText = `¡Hola jefe! Recibido y procesando. (Error en la respuesta de la API de Gemini: ${errMsg})`;
              }
           } catch (e: any) {
              console.error("Gemini Fetch Exception:", e);
              aiText = `¡Hola jefe! Recibido y procesando. (Error de red/conexión al llamar a Gemini: ${e.message})`;
           }
        }

        // Analizar si el mensaje contiene una instrucción de publicación en el foro
        // 1. Intentar con formato plano (TITLE/CONTENT)
        const titlePlainMatch = aiText.match(/\[PUBLISH_TITLE\]:\s*(.*?)(?=\n|\[PUBLISH_CONTENT\]|$)/i);
        const contentPlainMatch = aiText.match(/\[PUBLISH_CONTENT\]:\s*([\s\S]*)/i);
        
        if (titlePlainMatch && contentPlainMatch) {
          publishData = {
            titulo: titlePlainMatch[1].trim(),
            contenido: contentPlainMatch[1].trim()
          };
          
          // Limpiar aiText de los bloques de publicación para la respuesta del chat
          aiText = aiText.replace(/\[PUBLISH_TITLE\]:[\s\S]*?\[PUBLISH_CONTENT\]:/gi, '')
                         .replace(contentPlainMatch[0], '')
                         .trim();
          if (!aiText) {
            aiText = `¡Hola jefe! He investigado sobre el tema en internet y he publicado un análisis detallado en el foro de discusión.`;
          }
        } else {
          // 2. Intentar con formato JSON heredado
          const publishRegex = /\[PUBLISH_POST\]:\s*(\{.*\})/is;
          const match = aiText.match(publishRegex);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.titulo && parsed.contenido) {
                publishData = parsed;
                aiText = aiText.replace(publishRegex, '').trim();
              }
            } catch (jsonErr) {
              console.warn("Fallo al parsear JSON estricto, intentando extracción regex tolerante...");
              const titleMatch = match[1].match(/"titulo"\s*:\s*"([\s\S]*?)"\s*(?:,|\n|\})/i);
              const contentMatch = match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*$/is) || 
                                   match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*\}\s*$/is) ||
                                   match[1].match(/"contenido"\s*:\s*"([\s\S]*?)"\s*(?:\}\s*)?$/is);
              
              if (titleMatch && contentMatch) {
                publishData = {
                  titulo: titleMatch[1].trim(),
                  contenido: contentMatch[1].replace(/\\n/g, '\n').trim()
                };
                aiText = aiText.replace(publishRegex, '').trim();
              } else {
                console.error("Fallo completo en extracción de post autogenerado.");
              }
            }
          }
        }

        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente', remitente_id: agent.id, texto: aiText, canal: '#general'
        }]);

        // Si se extrajo un post del foro, publicarlo automáticamente
        if (publishData) {
          const newPost = {
            titulo: publishData.titulo,
            autor_nombre: `${agent.nombre} (@${agent.nickname})`,
            autor_rol: agent.rol,
            contenido: publishData.contenido
          };
          
          try {
            // Intentar guardar en Supabase
            const { data: inserted, error: insErr } = await supabase.from('tj_foro_posts').insert([newPost]).select();
            if (insErr) {
              console.warn("No se pudo guardar post en Supabase, guardando local...", insErr.message);
              const localPost: ForumPost = {
                id: `post-${Date.now()}`,
                ...newPost,
                creado_en: new Date().toISOString()
              };
              setForumPosts(prev => [localPost, ...prev]);
            } else if (inserted && inserted[0]) {
              setForumPosts(prev => [inserted[0], ...prev]);
            }
          } catch (dbErr) {
            console.warn("Exception al guardar post en Supabase, guardando local...");
            const localPost: ForumPost = {
              id: `post-${Date.now()}`,
              ...newPost,
              creado_en: new Date().toISOString()
            };
            setForumPosts(prev => [localPost, ...prev]);
          }
        }

        setIsTyping(null);
      }
    } catch (err) {}
    finally { setIsSending(false); }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostAuthor) return;

    const authorAgent = agentes.find(a => a.id === newPostAuthor);
    const authorName = authorAgent ? `${authorAgent.nombre} (@${authorAgent.nickname})` : 'Jefe';
    const authorRol = authorAgent ? authorAgent.rol : 'Administrador';

    const newPost = {
      titulo: newPostTitle.trim(),
      autor_nombre: authorName,
      autor_rol: authorRol,
      contenido: newPostContent.trim()
    };

    try {
      // Intentar guardar en Supabase
      const { data: inserted, error: insErr } = await supabase.from('tj_foro_posts').insert([newPost]).select();
      if (insErr) {
        console.warn("No se pudo guardar post manual en Supabase, guardando local...", insErr.message);
        const localPost: ForumPost = {
          id: `post-${Date.now()}`,
          ...newPost,
          creado_en: new Date().toISOString()
        };
        setForumPosts(prev => [localPost, ...prev]);
      } else if (inserted && inserted[0]) {
        setForumPosts(prev => [inserted[0], ...prev]);
      }
    } catch (dbErr) {
      console.warn("Exception al guardar post manual en Supabase, guardando local...");
      const localPost: ForumPost = {
        id: `post-${Date.now()}`,
        ...newPost,
        creado_en: new Date().toISOString()
      };
      setForumPosts(prev => [localPost, ...prev]);
    }
    
    // Reset Form
    setNewPostTitle('');
    setNewPostContent('');
    setIsCreatingPost(false);
  };

  // Pre-procesamiento de alertas personalizadas de Markdown
  const preprocessAlerts = (text: string): string => {
    const calloutRegex = />\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n((?:>\s*.*\n?)*)/gi;
    return text.replace(calloutRegex, (match, type, content) => {
      const cleanContent = content.split('\n')
        .map(line => line.replace(/^>\s?/, ''))
        .join('\n');
      
      const title = type.toUpperCase();
      let icon = 'ℹ️';
      if (title === 'TIP') icon = '💡';
      else if (title === 'WARNING') icon = '⚠️';
      else if (title === 'CAUTION') icon = '🛑';
      else if (title === 'IMPORTANT') icon = '⚡';
      
      const marked = (window as any).marked;
      const parsed = marked && marked.parse ? marked.parse(cleanContent) : cleanContent;
      
      return `<div class="p-4 rounded-xl my-4 border flex gap-3 ${
        type.toLowerCase() === 'note' ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' :
        type.toLowerCase() === 'tip' ? 'bg-green-500/10 border-green-500/30 text-green-200' :
        type.toLowerCase() === 'important' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' :
        type.toLowerCase() === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200' :
        'bg-red-500/10 border-red-500/30 text-red-200'
      }">
        <span class="text-xl flex-shrink-0">${icon}</span>
        <div class="flex-grow">
          <strong class="block mb-1 text-xs tracking-wider uppercase">${title}</strong>
          <div class="text-xs text-white/70">${parsed}</div>
        </div>
      </div>`;
    });
  };

  // Formatear markdown en HTML y preparar bloques Mermaid
  const renderMarkdown = (text: string) => {
    let rawHtml = preprocessAlerts(text);
    const marked = (window as any).marked;
    
    if (marked && marked.parse) {
      rawHtml = marked.parse(rawHtml);
    } else {
      rawHtml = rawHtml.replace(/\n/g, '<br>');
    }
    
    // Parsear HTML y convertir pre code.language-mermaid en div.mermaid-block
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const codeBlocks = doc.querySelectorAll('pre code.language-mermaid');
    
    codeBlocks.forEach((codeBlock, idx) => {
      const rawMermaid = codeBlock.textContent || '';
      const preParent = codeBlock.parentElement;
      if (preParent) {
        const mermaidDiv = doc.createElement('div');
        mermaidDiv.className = 'mermaid-block mermaid p-4 bg-black/40 rounded-xl border border-white/10 my-6 overflow-x-auto flex justify-center text-xs text-white';
        mermaidDiv.id = `mermaid-svg-tj-${idx}`;
        mermaidDiv.textContent = rawMermaid;
        preParent.replaceWith(mermaidDiv);
      }
    });

    // Aplicar resaltados si hay búsqueda
    if (reportSearch.trim()) {
      const term = reportSearch.trim();
      const regex = new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      
      const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let nextNode = walk.nextNode();
      while (nextNode) {
        textNodes.push(nextNode);
        nextNode = walk.nextNode();
      }
      
      textNodes.forEach(node => {
        const parent = node.parentNode as HTMLElement;
        if (parent && 
            parent.tagName !== 'CODE' && 
            parent.tagName !== 'PRE' && 
            !parent.classList.contains('mermaid') && 
            !parent.classList.contains('mermaid-block')) {
          const matches = node.nodeValue?.match(regex);
          if (matches) {
            const span = doc.createElement('span');
            span.innerHTML = (node.nodeValue || '').replace(regex, '<span class="bg-[#CCFF00]/30 text-[#CCFF00] px-1 rounded">$1</span>');
            parent.replaceChild(span, node);
            
            while (span.firstChild) {
              span.parentNode?.insertBefore(span.firstChild, span);
            }
            span.parentNode?.removeChild(span);
          }
        }
      });
    }
    
    return doc.body.innerHTML;
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden text-[12px]">
      
      {/* SIDEBAR IZQUIERDA: AGENTES */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-white/10 flex flex-col lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform`}>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <img src="/logo-tjo.jpg" className="w-8 h-8 rounded border border-[#CCFF00]/30 shadow-[0_0_10px_#CCFF0044]" alt="" />
          <span className="font-black italic uppercase">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">Especialistas IA</span>
          {agentes.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded bg-white/5 border border-white/5 relative group/agent">
              <div className="relative cursor-pointer" onClick={() => handleOpenProfile(a)} title="Ver perfil del especialista">
                <img src={a.avatar_url} className="w-10 h-10 rounded bg-black border border-white/10 hover:border-[#CCFF00] transition-all object-cover" alt="" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#CCFF00] border border-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[10px] truncate">@{a.nickname}</p>
                <p className="text-[8px] text-white/40 truncate uppercase">{a.rol}</p>
              </div>
              <div className="flex items-center gap-1.5 opacity-40 group-hover/agent:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setResearchAgent(a.id);
                    setShowResearchModal(true);
                  }}
                  disabled={isResearching || isSending || isTyping !== null}
                  className="text-white hover:text-[#CCFF00] transition-colors disabled:opacity-30 disabled:hover:text-white/40"
                  title="Buscar en internet y publicar"
                >
                  <Globe size={11} />
                </button>
                <button onClick={() => setEditingAgente(a)} className="text-white hover:text-[#CCFF00] transition-colors" title="Editar"><Edit3 size={11}/></button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/10 space-y-2">
          <button onClick={() => setIsAutoActive(!isAutoActive)} className={`w-full py-3 rounded text-[10px] font-bold border transition-all ${isAutoActive ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_10px_#CCFF0044]' : 'bg-white/5 text-white/40'}`}>
            {isAutoActive ? 'AGENTS_ACTIVE' : 'ACTIVATE_AGENTS'}
          </button>
          <button 
            onClick={() => setShowResearchModal(true)} 
            disabled={isResearching}
            className="w-full py-3 rounded text-[10px] font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Globe size={11} className={isResearching ? 'animate-spin' : ''} />
            <span>{isResearching ? 'Investigando...' : 'Ronda de Investigación IA'}</span>
          </button>
        </div>
      </aside>

      {/* PANEL CENTRAL PRINCIPAL */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden"><Menu size={18}/></button>
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Mainframe</span>
          </div>

          {/* NAVEGACIÓN: CHAT VS FORO */}
          <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button 
              onClick={() => setActiveView('chat')} 
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${activeView === 'chat' ? 'bg-[#CCFF00] text-black shadow-[0_0_8px_#CCFF0022]' : 'text-white/60 hover:text-white'}`}
            >
              💬 CHAT
            </button>
            <button 
              onClick={() => setActiveView('forum')} 
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${activeView === 'forum' ? 'bg-[#CCFF00] text-black shadow-[0_0_8px_#CCFF0022]' : 'text-white/60 hover:text-white'}`}
            >
              📈 FORO TENDENCIAS
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchData} className={`p-2 ${isSyncing ? 'animate-spin text-[#CCFF00]' : 'text-white/40'}`}><RefreshCw size={14}/></button>
            <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border ${isVoiceEnabled ? 'border-[#CCFF00] text-[#CCFF00]' : 'border-white/10 text-white/20'}`}><Activity size={14}/></button>
          </div>
        </header>
 
        {/* PANTALLA DE OPERACIONES: AGENTES TRABAJANDO (FULL SCREEN OVERLAY) */}
        {isResearching && (
          <div className="absolute inset-x-0 bottom-0 top-16 z-30 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-300 select-none">
            {/* Cabecera de la Pantalla */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[9px] font-black uppercase tracking-[0.2em] animate-pulse">
                <Globe size={10} className="animate-spin text-[#CCFF00]" />
                <span>Búsqueda en Internet Activa</span>
              </div>
              <h2 className="text-lg md:text-xl font-black tracking-wider text-white">SALA DE OPERACIONES DE AGENTES</h2>
              <p className="text-[10px] text-white/50 max-w-sm mx-auto">
                Los especialistas de TJ FITLAB están investigando en la web y redactando sus conclusiones para el foro.
              </p>
            </div>

            {/* Visualizador de Agentes */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 w-full max-w-4xl px-4">
              {agentes.map(a => {
                const isCurrent = researchStatus.includes(`@${a.nickname}`);
                const isCompleted = (() => {
                  if (researchAgent !== 'all') {
                    if (researchProgress === 100) return a.id === researchAgent || a.nickname === researchAgent;
                    return false;
                  }
                  if (researchProgress === 100) return true;
                  const currentIndex = agentes.findIndex(ag => researchStatus.includes(`@${ag.nickname}`));
                  if (currentIndex === -1) return false;
                  const myIndex = agentes.findIndex(ag => ag.id === a.id);
                  return myIndex < currentIndex;
                })();
                const isInactiveInSingle = researchAgent !== 'all' && (a.id !== researchAgent && a.nickname !== researchAgent);
                
                return (
                  <div 
                    key={a.id} 
                    className={`p-4 rounded-xl border flex flex-col items-center text-center space-y-3 transition-all duration-500 ${
                      isCurrent 
                        ? 'border-[#CCFF00] bg-[#CCFF00]/5 shadow-[0_0_20px_#CCFF0015] scale-105' 
                        : isCompleted
                          ? 'border-indigo-500/40 bg-indigo-500/5 opacity-70'
                          : isInactiveInSingle
                            ? 'border-white/5 bg-white/[0.01] opacity-20'
                            : 'border-white/5 bg-white/[0.02] opacity-40'
                    }`}
                  >
                    <div className="relative">
                      <img src={a.avatar_url} className={`w-12 h-12 rounded bg-black border ${isCurrent ? 'border-[#CCFF00] shadow-[0_0_15px_#CCFF0033]' : 'border-white/10'}`} alt="" />
                      {isCurrent && (
                        <div className="absolute inset-0 rounded border-2 border-[#CCFF00] animate-ping opacity-75"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-[10px] text-white">@{a.nickname}</p>
                      <p className="text-[8px] text-white/40 uppercase font-medium">{a.rol}</p>
                    </div>
                    
                    <div className="text-[9px] font-bold">
                      {isCurrent ? (
                        <span className="text-[#CCFF00] animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping" />
                          Buscando...
                        </span>
                      ) : isCompleted ? (
                        <span className="text-indigo-400 flex items-center gap-1">
                          ✅ Listo
                        </span>
                      ) : (
                        <span className="text-white/20">⏳ Espera</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra de Carga */}
            <div className="w-full max-w-xl space-y-2 px-4">
              <div className="flex justify-between items-center text-[10px] font-bold text-white/60">
                <span className="text-[#CCFF00]/90 font-mono tracking-wider uppercase">{researchStatus}</span>
                <span className="font-mono text-white/80">{researchProgress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden border border-white/5 p-0.5">
                <div className="bg-[#CCFF00] h-1.5 transition-all duration-500 rounded-full shadow-[0_0_10px_#CCFF0088]" style={{ width: `${researchProgress}%` }}></div>
              </div>
            </div>

            {/* Consola de Logs */}
            <div className="w-full max-w-xl bg-black border border-white/10 rounded-lg p-4 h-28 font-mono text-[9px] text-[#CCFF00]/70 overflow-hidden relative shadow-inner">
              <div className="absolute top-2 right-2 flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/70" />
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
              </div>
              <div className="space-y-1 overflow-y-auto h-full scrollbar-hide select-text">
                <p className="text-white/40">&gt; npm run agents:search --topic="{researchTopic || 'default'}" --agent="{researchAgent}"</p>
                <p className="text-indigo-400">&gt; Conexión de red establecida con éxito. API key activa.</p>
                {researchAgent !== 'all' ? (
                  <>
                    <p>&gt; [SYS] Inicializando agente especializado: @{agentes.find(a => a.id === researchAgent || a.nickname === researchAgent)?.nickname}...</p>
                    <p>&gt; [SYS] Buscando en internet y analizando fuentes de información de 2026...</p>
                    {researchProgress === 100 && (
                      <p className="text-white font-bold animate-pulse">&gt; [SUCCESS] Análisis finalizado e insertado en el foro con referencias.</p>
                    )}
                  </>
                ) : (
                  <>
                    {researchProgress >= 0 && <p>&gt; [SYS] Inicializando sistema de agentes cognitivos...</p>}
                    {researchProgress >= 10 && <p>&gt; [SYS] @Programador ha iniciado búsqueda de IoT wearables y sensores...</p>}
                    {researchProgress >= 20 && <p className="text-indigo-300">&gt; [OK] @Programador ha publicado su informe: "Tecnología en Gimnasios 2026"</p>}
                    {researchProgress >= 40 && <p>&gt; [SYS] @CommunityManager ha iniciado búsqueda de hashtags de TikTok e Instagram...</p>}
                    {researchProgress >= 50 && <p className="text-indigo-300">&gt; [OK] @CommunityManager ha publicado su informe sobre tendencias virales.</p>}
                    {researchProgress >= 60 && <p>&gt; [SYS] @Legal ha iniciado búsqueda de regulaciones biométricas...</p>}
                    {researchProgress >= 70 && <p className="text-[#CCFF00]">&gt; [OK] @Legal ha publicado su informe sobre privacidad de datos en fitness.</p>}
                    {researchProgress >= 80 && <p>&gt; [SYS] @Data ha iniciado análisis de mercado de competiciones HYROX y Pilates...</p>}
                    {researchProgress >= 90 && <p className="text-indigo-300">&gt; [OK] @Data ha publicado su informe de cuota de mercado.</p>}
                    {researchProgress >= 98 && <p>&gt; [SYS] @Strategist ha iniciado planificación de operaciones boutique...</p>}
                    {researchProgress === 100 && (
                      <p className="text-white font-bold animate-pulse">&gt; [SUCCESS] Ronda completada. Sincronizando base de datos Supabase...</p>
                    )}
                  </>
                )}
                <div className="inline-block w-1.5 h-3 bg-[#CCFF00] animate-pulse ml-1 align-middle"></div>
              </div>
            </div>
          </div>
        )}
 
        {/* CONTENIDO INTERNO EN BASE A LA VISTA */}
        {activeView === 'chat' ? (
          // CONTENIDO CHAT DE AGENTES (VISTA ORIGINAL)
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scrollbar-hide">
              {mensajes.map(m => (
                <div key={m.id} className={`flex gap-3 max-w-3xl mx-auto animate-in items-start ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-3.5 rounded-lg' : ''}`}>
                  <img 
                    src={m.remitente_tipo === 'agente' ? (agentes.find(a => a.id === m.remitente_id)?.avatar_url || '/avatars/programador.png') : '/avatars/jefe.png'} 
                    onClick={() => {
                      if (m.remitente_tipo === 'agente') {
                        const ag = agentes.find(a => a.id === m.remitente_id);
                        if (ag) handleOpenProfile(ag);
                      } else {
                        handleOpenJefeProfile();
                      }
                    }}
                    className="w-8 h-8 rounded bg-black border border-white/10 cursor-pointer hover:border-[#CCFF00] transition-all object-cover flex-shrink-0" 
                    title="Ver perfil"
                    alt="" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">{m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Jefe'}</p>
                    <p className={`text-[12px] leading-relaxed break-words ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90' : 'text-white/80'}`}>{m.texto}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 max-w-3xl mx-auto items-start">
                  <div className="w-8 h-8 rounded bg-[#CCFF00] text-black flex items-center justify-center text-[10px] font-black shadow-[0_0_10px_#CCFF0044] animate-pulse flex-shrink-0">
                    AI
                  </div>
                  <div className="flex-1 p-3.5 rounded-lg bg-white/5 border border-white/5 animate-pulse text-[12px] text-white/50">
                    Redactando respuesta...
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 bg-black border-t border-white/10">
               <form onSubmit={handleSend} className="max-w-2xl mx-auto relative">
                {/* SUGERENCIAS DE MENCIÓN (@) */}
                {showMentionSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-2 border-b border-white/5 bg-white/[0.02]">
                      <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider block">Mencionar Especialista</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide divide-y divide-white/5">
                      {filteredSuggestions.map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handleSelectMention(a.nickname)}
                          className="w-full px-3 py-2 flex items-center gap-3.5 hover:bg-[#CCFF00]/5 text-left transition-all group animate-all"
                        >
                          <img src={a.avatar_url} className="w-6 h-6 rounded bg-black border border-white/10 group-hover:border-[#CCFF00] object-cover flex-shrink-0" alt="" />
                          <div className="min-w-0 flex-grow">
                            <p className="text-[10px] font-bold text-white group-hover:text-[#CCFF00]">@{a.nickname}</p>
                            <p className="text-[8px] text-white/40 uppercase font-mono tracking-wide truncate">{a.rol}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <input 
                  type="text" 
                  ref={inputRef}
                  value={inputText} 
                  onChange={handleInputChange} 
                  placeholder="Escribe tu mensaje... Usa @ para mencionar a un especialista" 
                  disabled={isSending} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-base md:text-[12px] text-white focus:border-[#CCFF00]/50 outline-none transition-all" 
                />
                <button type="submit" disabled={!inputText.trim() || isSending} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center transition-all"><Send size={16}/></button>
              </form>
            </div>
          </>
        ) : (
          // CONTENIDO DEL FORO DE TENDENCIAS (NUEVA INTEGRACIÓN)
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
            {/* SUB-MENU TABS DEL FORO */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                <button 
                  onClick={() => setForumActiveTab('trends')} 
                  className={`px-3 py-2 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${forumActiveTab === 'trends' ? 'bg-[#CCFF00] text-black shadow-[0_0_8px_#CCFF0022]' : 'text-white/60 hover:text-white'}`}
                >
                  📈 Tendencias 2026
                </button>
                <button 
                  onClick={() => setForumActiveTab('proposal')} 
                  className={`px-3 py-2 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${forumActiveTab === 'proposal' ? 'bg-[#CCFF00] text-black shadow-[0_0_8px_#CCFF0022]' : 'text-white/60 hover:text-white'}`}
                >
                  🎯 Adaptación TJ
                </button>
                <button 
                  onClick={() => setForumActiveTab('discussion')} 
                  className={`px-3 py-2 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${forumActiveTab === 'discussion' ? 'bg-[#CCFF00] text-black shadow-[0_0_8px_#CCFF0022]' : 'text-white/60 hover:text-white'}`}
                >
                  👥 Foro Discusión
                </button>
              </div>

              {/* ACCIONES Y BUSCADOR */}
              {forumActiveTab !== 'discussion' ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-grow sm:w-60">
                    <input 
                      type="text" 
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder="Buscar en el informe..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-[10px] text-white focus:outline-none focus:border-[#CCFF00]/40"
                    />
                    <Search size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                  </div>
                  <button 
                    onClick={() => window.print()} 
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all"
                    title="Imprimir / Exportar a PDF"
                  >
                    <Printer size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowResearchModal(true)}
                    disabled={isResearching}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] tracking-wider uppercase transition-all shadow-[0_0_10px_#6366F133] disabled:opacity-50"
                  >
                    <Globe size={12} className={isResearching ? 'animate-spin' : ''} />
                    <span>{isResearching ? 'Investigando...' : 'Ronda de Investigación IA'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsCreatingPost(true);
                      if (agentes.length > 0) {
                        setNewPostAuthor(agentes[0].id);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#CCFF00] text-black font-bold text-[9px] tracking-wider uppercase hover:bg-white transition-all shadow-[0_0_10px_#CCFF0022]"
                  >
                    <PlusCircle size={12} />
                    <span>Publicar Tendencia</span>
                  </button>
                </div>
              )}
            </div>

            {/* VISTA DEL INFORME O FEED DEL FORO */}
            {forumActiveTab !== 'discussion' ? (
              <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-10 shadow-2xl relative">
                <div 
                  className="prose prose-invert max-w-none text-white/80 text-[12px] leading-relaxed markdown-body"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(reportMarkdown) }}
                />
              </div>
            ) : selectedPost ? (
              // VISTA DETALLADA DEL ARTÍCULO EXPANDIDO
              <div className="max-w-4xl mx-auto space-y-6 animate-in">
                <button 
                  onClick={() => setSelectedPost(null)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-white/80 hover:text-[#CCFF00] transition-all text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                >
                  &larr; Volver al Foro
                </button>
                
                <div className="p-6 md:p-10 rounded-2xl bg-[#090909] border border-white/10 shadow-2xl space-y-6">
                  {/* CABECERA DEL ARTÍCULO */}
                  <div className="flex gap-4 items-start border-b border-white/5 pb-6">
                    <img 
                      src={
                        agentes.find(a => selectedPost.autor_nombre.toLowerCase().includes(a.nombre.toLowerCase()) || selectedPost.autor_nombre.toLowerCase().includes(a.nickname.toLowerCase()))?.avatar_url || 
                        '/avatars/jefe.png'
                      } 
                      onClick={() => {
                        const ag = agentes.find(a => selectedPost.autor_nombre.toLowerCase().includes(a.nombre.toLowerCase()) || selectedPost.autor_nombre.toLowerCase().includes(a.nickname.toLowerCase()));
                        if (ag) handleOpenProfile(ag);
                        else handleOpenJefeProfile();
                      }}
                      className="w-12 h-12 rounded bg-black border border-white/10 shadow-[0_0_10px_#CCFF0011] flex-shrink-0 cursor-pointer hover:border-[#CCFF00] transition-all object-cover" 
                      title="Ver perfil"
                      alt="" 
                    />
                    <div className="min-w-0">
                      <h2 className="text-base md:text-lg font-black text-[#CCFF00] leading-tight">{selectedPost.titulo}</h2>
                      <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mt-2">
                        Por: {selectedPost.autor_nombre} — <span className="text-[#CCFF00]/75">{selectedPost.autor_rol}</span>
                      </p>
                      <p className="text-[8px] text-white/30 mt-0.5">Publicado: {new Date(selectedPost.creado_en).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* DISEÑO EN DOS COLUMNAS */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* COLUMNA IZQUIERDA (2/3): CUERPO DEL ARTÍCULO */}
                    <div className="lg:col-span-2 space-y-6 min-w-0">
                      <div 
                        className="prose prose-invert max-w-none text-white/80 text-[12px] leading-relaxed markdown-body"
                        dangerouslySetInnerHTML={{ 
                          __html: (window as any).marked && (window as any).marked.parse 
                            ? (window as any).marked.parse(selectedPost.contenido) 
                            : selectedPost.contenido 
                        }}
                      />
                    </div>

                    {/* COLUMNA DERECHA (1/3): FICHA TÉCNICA, ENLACES Y ESTADÍSTICAS */}
                    <div className="space-y-6">
                      {/* 🤖 FICHA DEL AGENTE */}
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                        <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Investigador</p>
                        <div className="flex items-center gap-3">
                          <img 
                            src={
                              agentes.find(a => selectedPost.autor_nombre.toLowerCase().includes(a.nombre.toLowerCase()) || selectedPost.autor_nombre.toLowerCase().includes(a.nickname.toLowerCase()))?.avatar_url || 
                              '/avatars/jefe.png'
                            } 
                            onClick={() => {
                              const ag = agentes.find(a => selectedPost.autor_nombre.toLowerCase().includes(a.nombre.toLowerCase()) || selectedPost.autor_nombre.toLowerCase().includes(a.nickname.toLowerCase()));
                              if (ag) handleOpenProfile(ag);
                              else handleOpenJefeProfile();
                            }}
                            className="w-9 h-9 rounded bg-black border border-white/10 flex-shrink-0 cursor-pointer hover:border-[#CCFF00] transition-all object-cover" 
                            title="Ver perfil"
                            alt="" 
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-white truncate">{selectedPost.autor_nombre.split('(')[0].trim()}</p>
                            <p className="text-[8px] text-[#CCFF00] uppercase font-bold tracking-wider truncate">{selectedPost.autor_rol}</p>
                          </div>
                        </div>
                        {/* Habilidades del Agente */}
                        {(() => {
                          const ag = agentes.find(a => selectedPost.autor_nombre.toLowerCase().includes(a.nombre.toLowerCase()) || selectedPost.autor_nombre.toLowerCase().includes(a.nickname.toLowerCase()));
                          if (ag && ag.skills) {
                            return (
                              <div className="pt-2.5 border-t border-white/5">
                                <p className="text-[7px] text-white/40 uppercase tracking-wider mb-1.5">Habilidades:</p>
                                <div className="flex flex-wrap gap-1">
                                  {ag.skills.split(',').map((skill, index) => (
                                    <span key={index} className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">{skill.trim()}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* 🌐 ENLACES DE REFERENCIA EXTRACTOR */}
                      {(() => {
                        const urls = extractUrls(selectedPost.contenido);
                        if (urls.length > 0) {
                          return (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                              <p className="text-[8px] font-bold text-[#CCFF00]/80 uppercase tracking-widest">
                                🔗 Enlaces de Consulta
                              </p>
                              <div className="space-y-1.5">
                                {urls.map((url, index) => {
                                  let label = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
                                  if (label.length > 25) label = label.substring(0, 22) + '...';
                                  return (
                                    <a 
                                      key={index} 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="flex items-center justify-between p-2 rounded bg-[#CCFF00]/5 border border-[#CCFF00]/10 hover:border-[#CCFF00]/40 text-[#CCFF00] hover:text-white transition-all text-[9px] group"
                                    >
                                      <span className="truncate font-semibold">{label}</span>
                                      <span className="text-[7px] opacity-65 group-hover:opacity-100">&nearr;</span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* 📊 TARJETAS DE ESTADÍSTICAS EXTRAÍDAS */}
                      {(() => {
                        const stats = extractStats(selectedPost.contenido);
                        if (stats.length > 0) {
                          return (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                              <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">
                                📊 Estadísticas del Post
                              </p>
                              <div className="space-y-2">
                                {stats.map((stat, index) => (
                                  <div key={index} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[9px] text-white/70 leading-snug">
                                    <div className="font-bold text-[#CCFF00] mb-0.5 text-[8px] uppercase tracking-wider">Dato #{index+1}</div>
                                    {stat}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto animate-in">
                {forumPosts.map(post => {
                  // Resolver avatar del agente
                  const cleanName = post.autor_nombre.split('(')[0].trim().replace('@', '');
                  const agent = agentes.find(a => a.nickname.toLowerCase() === cleanName.toLowerCase() || a.nombre.toLowerCase() === cleanName.toLowerCase());
                  const avatar = agent?.avatar_url || '/avatars/jefe.png';
                  
                  return (
                    <div 
                      key={post.id} 
                      onClick={() => setSelectedPost(post)}
                      className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-[#CCFF00]/30 transition-all flex gap-4 animate-in hover:bg-white/[0.02] cursor-pointer group items-center"
                    >
                      <img 
                        src={avatar} 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (agent) handleOpenProfile(agent);
                          else handleOpenJefeProfile();
                        }}
                        className="w-12 h-12 rounded bg-black flex-shrink-0 border border-white/10 cursor-pointer hover:border-[#CCFF00] transition-all object-cover" 
                        title="Ver perfil"
                        alt="" 
                      />
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <h3 className="font-bold text-[13px] text-white group-hover:text-[#CCFF00] transition-all truncate">{post.titulo}</h3>
                          <span className="text-[8px] text-white/40 flex-shrink-0">{new Date(post.creado_en).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[8px] text-white/30 font-bold uppercase tracking-wider mb-2">
                          Por: {post.autor_nombre} — <span className="text-[#CCFF00]/60">{post.autor_rol}</span>
                        </p>
                        <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2 mb-3">
                          {post.contenido.replace(/[#*`_\[\]\(\)]/g, '').substring(0, 160)}...
                        </p>
                        <span className="text-[9px] font-black text-[#CCFF00] uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-all">
                          Leer artículo completo &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
                {forumPosts.length === 0 && (
                  <p className="text-center text-white/40 py-10 italic">No hay publicaciones en el foro todavía.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL CONFIGURACIÓN AGENTE */}
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-xl p-8 shadow-2xl relative">
            <button onClick={() => setEditingAgente(null)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={16}/></button>
            <div className="flex items-center gap-3 mb-6"><Settings2 size={16} className="text-[#CCFF00]" /><h2 className="text-xs font-bold uppercase tracking-[0.2em]">Configurar Agente</h2></div>
            <div className="space-y-4">
              <div><label className="text-[8px] text-white/30 font-bold block mb-1 uppercase tracking-widest">Identificador</label><input type="text" value={editingAgente.nombre} onChange={(e) => setEditingAgente({...editingAgente, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none" /></div>
              <div><label className="text-[8px] text-white/30 font-bold block mb-1 uppercase tracking-widest">Rol Sistema</label><input type="text" value={editingAgente.rol} onChange={(e) => setEditingAgente({...editingAgente, rol: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none" /></div>
              <button onClick={async () => { await supabase.from('tj_agentes').update({ nombre: editingAgente.nombre, rol: editingAgente.rol }).eq('id', editingAgente.id); setEditingAgente(null); fetchData(); }} className="w-full bg-[#CCFF00] text-black font-black py-4 rounded text-[10px] tracking-widest hover:bg-white transition-all">APLICAR CAMBIOS</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR PUBLICACIÓN FORO */}
      {isCreatingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-xl p-8 shadow-2xl relative">
            <button onClick={() => setIsCreatingPost(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={16}/></button>
            <div className="flex items-center gap-3 mb-6">
              <PlusCircle size={16} className="text-[#CCFF00]" />
              <h2 className="text-xs font-bold uppercase tracking-[0.2em]">Nueva Publicación de Tendencias</h2>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-1 uppercase tracking-widest">Título de la Tendencia / Oportunidad</label>
                <input 
                  type="text" 
                  value={newPostTitle} 
                  onChange={(e) => setNewPostTitle(e.target.value)} 
                  placeholder="Ej: Ozempic y la masa muscular..."
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none" 
                  required
                />
              </div>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-1 uppercase tracking-widest">Autor / Agente Emisor</label>
                <select 
                  value={newPostAuthor}
                  onChange={(e) => setNewPostAuthor(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none"
                  required
                >
                  <option value="jefe" className="bg-[#0A0A0A]">Jefe (Administrador)</option>
                  {agentes.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#0A0A0A]">@{a.nickname} — {a.rol}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-1 uppercase tracking-widest">Contenido (Soporta Markdown)</label>
                <textarea 
                  value={newPostContent} 
                  onChange={(e) => setNewPostContent(e.target.value)} 
                  placeholder="Detalla la tendencia, estadísticas y oportunidades de negocio/mejora..."
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none h-32" 
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#CCFF00] text-black font-black py-4 rounded text-[10px] tracking-widest hover:bg-white transition-all uppercase"
              >
                Publicar en el Foro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN TEMA DE INVESTIGACIÓN DE AGENTES */}
      {showResearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-xl p-8 shadow-2xl relative">
            <button onClick={() => setShowResearchModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white" disabled={isResearching}><X size={16}/></button>
            <div className="flex items-center gap-3 mb-6">
              <Globe size={16} className="text-[#CCFF00]" />
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Investigación en Internet</h2>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] text-white/60 leading-relaxed">
                Los agentes colaboradores buscarán en tiempo real en internet usando <strong>Google Search Grounding</strong>. Elige si quieres consultar a todos o a un especialista específico.
              </p>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-1.5 uppercase tracking-widest">Agente Investigador</label>
                <select 
                  value={researchAgent}
                  onChange={(e) => setResearchAgent(e.target.value)}
                  disabled={isResearching}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3.5 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none"
                >
                  <option value="all" className="bg-[#0A0A0A]">Todos los agentes (Ronda completa)</option>
                  {agentes.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#0A0A0A]">@{a.nickname} — {a.rol}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-1.5 uppercase tracking-widest">Tema de Investigación Especializada (Opcional)</label>
                <input 
                  type="text" 
                  value={researchTopic} 
                  onChange={(e) => setResearchTopic(e.target.value)} 
                  placeholder="Ej: Crioterapia y longevidad, HYROX 2026, suplementación..."
                  disabled={isResearching}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3.5 text-base md:text-xs text-white focus:border-[#CCFF00]/40 outline-none" 
                />
              </div>
              <button 
                onClick={runAllAgentsResearchRound}
                disabled={isResearching}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded text-[10px] tracking-widest hover:bg-indigo-500 transition-all uppercase flex items-center justify-center gap-2 shadow-[0_0_15px_#6366F122] disabled:opacity-50"
              >
                <RefreshCw size={12} className={isResearching ? 'animate-spin' : ''} />
                <span>{isResearching ? 'PROCESANDO...' : (researchAgent === 'all' ? 'INICIAR RONDA COMPLETA' : 'INICIAR INVESTIGACIÓN')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERFIL DETALLADO DE AGENTE / JEFE */}
      {profileToShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Botón Cerrar */}
            <button 
              onClick={() => setProfileToShow(null)} 
              className="absolute top-4 right-4 z-10 text-white/40 hover:text-white transition-colors bg-black/60 p-1.5 rounded-full"
            >
              <X size={14}/>
            </button>

            {/* CONTENIDO SCROLLABLE DE LA FICHA */}
            <div className="overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-hide">
              {/* Sección Superior: Imagen en Grande (Centrada) */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative group">
                  <img 
                    src={profileToShow.avatar_url} 
                    className="w-56 h-56 md:w-72 md:h-72 rounded-2xl bg-black border border-white/15 shadow-[0_0_35px_rgba(204,255,0,0.25)] object-cover transition-transform duration-300" 
                    alt="" 
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#CCFF00] border-2 border-black flex items-center justify-center text-[10px] font-bold text-black shadow-lg">
                    ✓
                  </div>
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">@{profileToShow.nickname}</h3>
                  <p className="text-[11px] text-[#CCFF00] font-bold uppercase tracking-wider mt-1">{profileToShow.rol}</p>
                  <p className="text-[9px] text-white/40 mt-0.5 font-mono">{profileToShow.nombre}</p>
                </div>
              </div>

              {/* Sección Inferior: Ficha de Información */}
              <div className="space-y-4 border-t border-white/5 pt-4 text-left">
                <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-white/80 border-b border-white/5 pb-2">Detalles del Colaborador</h4>
                
                <div className="space-y-4 text-[11px] leading-relaxed">
                  <div>
                    <span className="text-[8px] text-white/30 font-bold uppercase block tracking-wider">Habilidades y Skills</span>
                    <p className="text-white/95 mt-0.5 font-mono">{profileToShow.skills}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 font-bold uppercase block tracking-wider">A qué se dedica</span>
                    <p className="text-white/85 mt-0.5">{profileToShow.dedicacion}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 font-bold uppercase block tracking-wider">Cualidades Clave</span>
                    <p className="text-white/85 mt-0.5">{profileToShow.cualidades}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#CCFF00]/5 border border-[#CCFF00]/15">
                    <span className="text-[8px] text-[#CCFF00] font-black uppercase block tracking-wider">¿En qué suma para la empresa?</span>
                    <p className="text-white/95 mt-1.5 italic">"{profileToShow.suma}"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Send, Edit3, Activity, MessageSquare, Settings2, X, Menu, RefreshCw, Search, Printer, PlusCircle } from 'lucide-react';
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
  { id: '11111111-1111-1111-1111-111111111111', nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=code', estado_online: true, creado_en: '' },
  { id: '22222222-2222-2222-2222-222222222222', nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing', estado_online: true, creado_en: '' },
  { id: '33333333-3333-3333-3333-333333333333', nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal', estado_online: true, creado_en: '' },
  { id: '44444444-4444-4444-4444-444444444444', nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=data', estado_online: true, creado_en: '' },
  { id: '55555555-5555-5555-5555-555555555555', nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy', estado_online: true, creado_en: '' }
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

  // MODAL CREAR PUBLICACIÓN
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostAuthor, setNewPostAuthor] = useState('');

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
    } catch (err) { console.warn("DB offline, using mock data"); }
    finally { setIsSyncing(false); }
  };

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('ultra-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'tj_mensajes' }, fetchData).subscribe();
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

      if (isAutoActive) {
        setIsTyping("ALL");
        const agent = agentes[Math.floor(Math.random() * agentes.length)] || agentes[0];
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        let aiText = "¡Hola jefe! Recibido y procesando.";
        let publishData: { titulo: string; contenido: string } | null = null;

        if (apiKey) {
           const promptText = `Eres ${agent.nombre} (rol: ${agent.rol}). 
Tienes acceso a buscar en internet en tiempo real a través de Google Search. Utilízalo siempre que te pregunten sobre datos actuales, noticias, tendencias o estadísticas del fitness en 2026.
SIEMPRE di "¡Hola jefe!" al inicio de tu respuesta.

Si encuentras una tendencia importante de fitness, noticias o estudios científicos recientes, o una oportunidad de negocio/mejora relevante para TJ FITLAB y quieres publicarla en el foro del equipo, debes añadir al final de tu respuesta EXACTAMENTE esta estructura en formato JSON:
[PUBLISH_POST]: {"titulo": "Título corto y llamativo de la tendencia", "contenido": "Explicación detallada de la tendencia en formato Markdown, incluyendo datos clave, estadísticas encontradas en internet y cómo aplicarla en TJ FITLAB."}

Intenta que el JSON no tenga saltos de línea reales dentro de los valores de texto (usa \\n para saltos de línea y escapa las comillas dobles si es necesario).
Ejemplo de respuesta si decides publicar:
¡Hola jefe! He investigado sobre el crecimiento de HYROX en 2026... He publicado un artículo en el foro con los detalles.
[PUBLISH_POST]: {"titulo": "Crecimiento Exponencial de HYROX", "contenido": "El crecimiento de...\\n\\n**Recomendación:**..."}

Responde al usuario: ${userText}`;

           try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  contents: [{ parts: [{ text: promptText }] }],
                  tools: [{ googleSearch: {} }] // Habilitar Google Search grounding
                })
              });
              const resJson = await res.json();
              if (res.ok && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                 aiText = resJson.candidates[0].content.parts[0].text;
              }
           } catch (e) {}
        }

        // Analizar si el mensaje contiene una instrucción de publicación en el foro
        const publishRegex = /\[PUBLISH_POST\]:\s*(\{.*\})/is;
        const match = aiText.match(publishRegex);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.titulo && parsed.contenido) {
              publishData = parsed;
              // Limpiar la etiqueta del texto del chat
              aiText = aiText.replace(publishRegex, '').trim();
            }
          } catch (jsonErr) {
            console.error("Error al parsear el post autogenerado:", jsonErr);
          }
        }

        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente', remitente_id: agent.id, texto: aiText, canal: '#general'
        }]);

        // Si se extrajo un post del foro, publicarlo automáticamente
        if (publishData) {
          const newPost: ForumPost = {
            id: `post-${Date.now()}`,
            titulo: publishData.titulo,
            autor_nombre: `${agent.nombre} (@${agent.nickname})`,
            autor_rol: agent.rol,
            contenido: publishData.contenido,
            creado_en: new Date().toISOString()
          };
          setForumPosts(prev => [newPost, ...prev]);
        }

        setIsTyping(null);
      }
    } catch (err) {}
    finally { setIsSending(false); }
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostAuthor) return;

    const authorAgent = agentes.find(a => a.id === newPostAuthor);
    const authorName = authorAgent ? `${authorAgent.nombre} (@${authorAgent.nickname})` : 'Jefe';
    const authorRol = authorAgent ? authorAgent.rol : 'Administrador';

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      titulo: newPostTitle.trim(),
      autor_nombre: authorName,
      autor_rol: authorRol,
      contenido: newPostContent.trim(),
      creado_en: new Date().toISOString()
    };

    setForumPosts(prev => [newPost, ...prev]);
    
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
            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded bg-white/5 border border-white/5">
              <div className="relative">
                <img src={a.avatar_url} className="w-7 h-7 rounded bg-black" alt="" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#CCFF00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[10px] truncate">@{a.nickname}</p>
                <p className="text-[8px] text-white/40 truncate uppercase">{a.rol}</p>
              </div>
              <button onClick={() => setEditingAgente(a)} className="text-white/20 hover:text-[#CCFF00] transition-colors"><Edit3 size={12}/></button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => setIsAutoActive(!isAutoActive)} className={`w-full py-3 rounded text-[10px] font-bold border transition-all ${isAutoActive ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_10px_#CCFF0044]' : 'bg-white/5 text-white/40'}`}>
            {isAutoActive ? 'AGENTS_ACTIVE' : 'ACTIVATE_AGENTS'}
          </button>
        </div>
      </aside>

      {/* PANEL CENTRAL PRINCIPAL */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10 relative">
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

        {/* CONTENIDO INTERNO EN BASE A LA VISTA */}
        {activeView === 'chat' ? (
          // CONTENIDO CHAT DE AGENTES (VISTA ORIGINAL)
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scrollbar-hide">
              {mensajes.map(m => (
                <div key={m.id} className={`flex gap-3 max-w-3xl mx-auto animate-in ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-3 rounded-lg' : ''}`}>
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0044]' : 'bg-white/10 text-white'}`}>{m.remitente_tipo === 'agente' ? 'AI' : 'OP'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">{m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Jefe'}</p>
                    <p className={`text-[12px] leading-relaxed break-words ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90' : 'text-white/80'}`}>{m.texto}</p>
                  </div>
                </div>
              ))}
              {isTyping && <div className="flex gap-3 max-w-3xl mx-auto"><div className="w-6 h-6 rounded bg-[#CCFF00] text-black flex items-center justify-center text-[8px] font-bold shadow-[0_0_10px_#CCFF0044]">...</div><div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5 animate-pulse">Pensando...</div></div>}
            </div>

            <div className="p-4 md:p-6 bg-black border-t border-white/10">
              <form onSubmit={handleSend} className="max-w-2xl mx-auto relative">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Instrucción inmediata..." disabled={isSending} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-base md:text-[12px] text-white focus:border-[#CCFF00]/50 outline-none" />
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
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {forumPosts.map(post => {
                  // Resolver avatar del agente
                  const cleanName = post.autor_nombre.split('(')[0].trim().replace('@', '');
                  const agent = agentes.find(a => a.nickname.toLowerCase() === cleanName.toLowerCase() || a.nombre.toLowerCase() === cleanName.toLowerCase());
                  const avatar = agent?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=jefe';
                  
                  return (
                    <div key={post.id} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex gap-4 animate-in">
                      <img src={avatar} className="w-9 h-9 rounded bg-black flex-shrink-0 border border-white/10" alt="" />
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <h3 className="font-bold text-[13px] text-[#CCFF00]">{post.titulo}</h3>
                          <span className="text-[8px] text-white/40">{new Date(post.creado_en).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-3">
                          Por: {post.autor_nombre} — <span className="text-[#CCFF00]/75">{post.autor_rol}</span>
                        </p>
                        <div 
                          className="text-[12px] text-white/80 leading-relaxed whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: (window as any).marked && (window as any).marked.parse ? (window as any).marked.parse(post.contenido) : post.contenido }}
                        />
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

      {/* SIDEBAR DERECHA: ANYTIME COACHING */}
      <aside className="hidden xl:flex w-80 flex-shrink-0 bg-[#1A0B2E] flex flex-col h-full border-l border-white/10">
        <header className="h-16 flex items-center px-6 border-b border-purple-500/20 bg-[#12071F]">
           <span className="text-[9px] font-black text-purple-200 uppercase tracking-widest italic">ANYTIME <span className="text-white">COACHING</span></span>
        </header>
        <div className="flex-1 flex flex-col overflow-hidden">
           <div className="p-4 border-b border-purple-500/10 text-center">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=auditor" className="w-10 h-10 mx-auto mb-1 rounded-full bg-purple-900 border border-purple-500" alt="" />
              <p className="text-[9px] font-bold text-white tracking-tight">Auditor Activo</p>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              <div className="grid grid-cols-2 gap-2">
                 <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20">
                    <p className="text-[7px] font-bold text-purple-400 uppercase mb-1">Total</p>
                    <p className="text-xl font-black text-white">{ultimoReporte.total_alumnos}</p>
                 </div>
                 <div className="p-3 rounded-xl bg-orange-950/10 border border-orange-500/20">
                    <p className="text-[7px] font-bold text-orange-400 uppercase mb-1">Pendientes</p>
                    <p className="text-xl font-bold text-orange-100">{ultimoReporte.mensajes_pendientes}</p>
                 </div>
              </div>

              {/* DIRECTORIO DE ALUMNOS */}
              <div className="flex-1 flex flex-col min-h-0 bg-black/20 rounded-xl border border-purple-500/10 overflow-hidden">
                 <div className="p-3 border-b border-purple-500/10">
                    <p className="text-[8px] font-bold text-purple-200 uppercase mb-2 tracking-widest">Directorio de Alumnos</p>
                    <div className="relative">
                       <input 
                         type="text" 
                         value={studentSearch}
                         onChange={(e) => setStudentSearch(e.target.value)}
                         placeholder="Buscar alumno..."
                         className="w-full bg-purple-950/30 border border-purple-500/20 rounded-lg py-1.5 px-3 text-[10px] text-white focus:outline-none focus:border-purple-400 transition-all placeholder:text-purple-300/40"
                       />
                       <Search size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/50" />
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-64 scrollbar-thin scrollbar-thumb-purple-900">
                    {(ultimoReporte.lista_alumnos || [])
                      .filter(name => name.toLowerCase().includes(studentSearch.toLowerCase()))
                      .map((name, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-purple-500/10 transition-all border border-transparent hover:border-purple-500/20 group cursor-default">
                           <div className="w-1.5 h-1.5 rounded-full bg-purple-500/40 group-hover:bg-purple-400 shadow-[0_0_5px_#A855F7]" />
                           <span className="text-[10px] text-purple-100/80 group-hover:text-white font-medium truncate">{name}</span>
                        </div>
                    ))}
                    {(ultimoReporte.lista_alumnos || []).filter(name => name.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                        <p className="text-[8px] text-purple-400/60 text-center py-4 italic uppercase">No se encontraron resultados</p>
                    )}
                 </div>
              </div>

              <div className="p-4 rounded-xl bg-red-950/10 border border-red-500/20 shadow-lg">
                 <p className="text-[8px] font-bold text-red-400 uppercase mb-2 italic tracking-widest">Alertas de Escaneo</p>
                 <div className="space-y-1">
                    {(ultimoReporte.pendientes_escaneo || []).map((n, i) => (<div key={i} className="text-[9px] text-red-100 flex justify-between border-b border-white/5 pb-1"><span>{n}</span><span className="text-red-500 font-black">!</span></div>))}
                 </div>
              </div>
           </div>
        </div>
        <div className="p-4 border-t border-purple-500/10 bg-[#12071F] flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22C55E]" />
           <span className="text-[7px] text-purple-300 font-bold uppercase tracking-widest">Live Feed: Operational</span>
        </div>
      </aside>

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
    </div>
  );
};

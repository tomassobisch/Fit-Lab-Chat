import React, { useState, useEffect, useRef } from 'react';
import { Send, Power, Edit3, Terminal, Cpu, Activity, MessageSquare, Settings2, X, Check, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal, ReporteGym } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";

const INITIAL_AGENTS: Agente[] = [
  { id: '11111111-1111-1111-1111-111111111111', nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=code', estado_online: true, creado_en: '' },
  { id: '22222222-2222-2222-2222-222222222222', nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing', estado_online: true, creado_en: '' },
  { id: '33333333-3333-3333-3333-333333333333', nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal', estado_online: true, creado_en: '' },
  { id: '44444444-4444-4444-4444-444444444444', nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=data', estado_online: true, creado_en: '' },
  { id: '55555555-5555-5555-5555-555555555555', nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy', estado_online: true, creado_en: '' }
];

const PREDETERMINED_RESPONSES: Record<string, Record<string, string>> = {
  'Programador': {
    'hola': 'Hola, soy el Senior Dev. Sistema operativo y listo para programar. ¿En qué puedo ayudarte con el código?',
    'status': 'Todos los sistemas están operativos. Conexión con Supabase: ESTABLE. Motor de IA: ACTIVO.',
    'error': 'He detectado un posible glitch en la matriz. Recomiendo revisar los logs de la consola y las variables de entorno.',
  },
  'CommunityManager': {
    'hola': '¡Hola! Aquí el equipo de Marketing. Listos para hacer brillar esta marca. ✨',
    'campaña': 'Estoy analizando las métricas actuales. El engagement está subiendo, ¡sigamos así!',
  },
  'Legal': {
    'hola': 'Saludos. Aquí el departamento Legal. Todos los procesos están bajo cumplimiento normativo.',
    'contrato': 'He revisado las cláusulas. Todo parece estar en orden según la ley de protección de datos vigente.',
  }
};

const FALLBACK_RESPONSES: Record<string, string> = {
  'Programador': 'Recibido. Estoy procesando tu solicitud técnica. Dame un momento para compilar la mejor solución.',
  'CommunityManager': '¡Entendido! Estoy ideando una estrategia creativa para eso. ¡Va a quedar genial!',
  'Legal': 'He tomado nota. Estoy verificando los términos legales para darte una respuesta precisa.',
  'Data': 'Analizando los puntos de datos. La tendencia sugiere que debemos proceder con precaución.',
  'Strategist': 'Plan de acción en desarrollo. Estoy coordinando los recursos para ejecutar esta tarea.'
};

export const TJOfficeChat: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>(INITIAL_AGENTS);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [ultimoReporte, setUltimoReporte] = useState<ReporteGym | null>(null);
  const [inputText, setInputText] = useState('');
  const [isAutoActive, setIsAutoActive] = useState(true);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);

    const lastWord = value.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionFilter(lastWord.slice(1).toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (nickname: string) => {
    const words = inputText.split(' ');
    words[words.length - 1] = `@${nickname} `;
    setInputText(words.join(' '));
    setShowMentions(false);
  };

  const speakMessage = (text: string, nickname: string) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    const cleanText = text.replace(/@\w+/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    if (nickname === 'Programador') { utterance.pitch = 0.8; utterance.rate = 1.1; }
    if (nickname === 'CommunityManager') { utterance.pitch = 1.2; }
    window.speechSynthesis.speak(utterance);
  };

  const fetchData = async () => {
    try {
      const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
      if (a?.length) setAgentes(a);
      const { data: m } = await supabase.from('tj_mensajes').select('*').order('creado_en', { ascending: true });
      if (m) setMensajes(m);

      const { data: r } = await supabase.from('tj_reportes').select('*').order('creado_en', { ascending: false }).limit(1);
      if (r?.[0]) setUltimoReporte(r[0]);
    } catch (err) { console.error("Error fetching data:", err); }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tj_mensajes' }, (payload) => {
        const newMessage = payload.new as Mensaje;
        setMensajes(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        if (newMessage.remitente_tipo === 'agente') {
          const agente = [...INITIAL_AGENTS, ...agentes].find(a => a.id === newMessage.remitente_id);
          speakMessage(newMessage.texto, agente?.nickname || '');
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tj_reportes' }, (payload) => {
        setUltimoReporte(payload.new as ReporteGym);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tj_agentes' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensajes]);

  const generateAgentResponse = async (agent: Agente, userText: string) => {
    setIsTyping(agent.id);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAn6pT_Rca1XgvOR1R7KKwS93DW2dh29dU';
    const lowerText = userText.toLowerCase();
    
    // 1. RESPUESTA PREDETERMINADA
    const agentKeywords = PREDETERMINED_RESPONSES[agent.nickname];
    if (agentKeywords) {
      const match = Object.keys(agentKeywords).find(key => lowerText.includes(key));
      if (match) {
        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente',
          remitente_id: agent.id,
          texto: agentKeywords[match],
          canal: '#general'
        }]);
        setIsTyping(null);
        return;
      }
    }

    // 2. INTENTO CON SDK DE GEMINI
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let contextText = "";
        if (agent.nickname === 'AuditorAnytime' || lowerText.includes('alumno') || lowerText.includes('reporte') || lowerText.includes('escaneo')) {
          contextText = ultimoReporte 
            ? `\n\nESTADO ACTUAL DEL GIMNASIO:\n` +
              `- Total Alumnos: ${ultimoReporte.total_alumnos}\n` +
              `- Mensajes Pendientes: ${ultimoReporte.mensajes_pendientes}\n` +
              `- Faltan Escaneo (${ultimoReporte.pendientes_escaneo.length}): ${ultimoReporte.pendientes_escaneo.slice(0, 10).join(', ')}...\n` +
              `- Sin Respuesta (${ultimoReporte.sin_respuesta.length}): ${ultimoReporte.sin_respuesta.slice(0, 10).join(', ')}...\n`
            : "\n\nNo hay reportes recientes disponibles.";
        }

        const prompt = `Responde como ${agent.rol} (@${agent.nickname}): ${userText}${contextText}`;
        const result = await model.generateContent(prompt);
        const aiText = result.response.text();

        if (aiText) {
          await supabase.from('tj_mensajes').insert([{ remitente_tipo: 'agente', remitente_id: agent.id, texto: aiText, canal: '#general' }]);
          setIsTyping(null);
          return;
        }
      } catch (e: any) {
        console.error("Gemini SDK Error:", e);
        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente',
          remitente_id: agent.id,
          texto: `⚠️ Error de IA: ${e.message}. Revisa la consola.`,
          canal: '#general'
        }]);
        setIsTyping(null);
        return;
      }
    }

    // 3. FALLBACK
    await supabase.from('tj_mensajes').insert([{
      remitente_tipo: 'agente',
      remitente_id: agent.id,
      texto: apiKey ? (FALLBACK_RESPONSES[agent.nickname] || "Recibido. Estoy analizando la información.") : "⚠️ IA_CONFIG_ERROR: No se detecta una API Key válida.",
      canal: '#general'
    }]);
    setIsTyping(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const tempText = inputText;
    
    try {
      const { data, error } = await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: tempText,
        canal: '#general'
      }]).select();

      if (error) throw error;
      if (data?.[0]) setMensajes(prev => [...prev, data[0] as Mensaje]);

      setInputText('');

      if (isAutoActive) {
        const mentioned = agentes.find(a => tempText.toLowerCase().includes(`@${a.nickname.toLowerCase()}`));
        const responder = mentioned || agentes.find(a => a.nickname === 'Programador') || agentes[0];
        setTimeout(() => generateAgentResponse(responder, tempText), 1000);
      }
    } catch (error: any) { 
      alert("Error: " + error.message); 
    } finally { 
      setIsSending(false); 
    }
  };

  const toggleAutoAgents = async () => {
    const newState = !isAutoActive;
    setIsAutoActive(newState);
    if (newState) {
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: '/SYSTEM_ACTIVATE_PROACTIVE_GREETINGS',
        canal: '#general'
      }]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden text-[12px]">
      {/* SIDEBAR IZQUIERDA - AGENTES TJ OFFICE */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-white/10 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/logo-tjo.jpg" className="w-8 h-8 rounded border border-[#CCFF00]/30 shadow-[0_0_10px_#CCFF0044]" alt="TJO" />
            <span className="font-black tracking-tighter text-sm italic uppercase">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/40"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="text-[9px] font-bold text-white/40 tracking-[0.2em] uppercase px-1">Especialistas IA</span>
          <div className="space-y-2">
            {agentes.map(a => (
              <div key={a.id} className="group p-2.5 rounded bg-white/5 border border-white/5 hover:border-[#CCFF00]/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img src={a.avatar_url} className="w-7 h-7 rounded bg-black" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black bg-[#CCFF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[10px] truncate">@{a.nickname}</p>
                    <p className="text-[8px] text-white/40 truncate uppercase font-medium">{a.rol}</p>
                  </div>
                  <button onClick={() => setEditingAgente(a)} className="text-white/20 hover:text-[#CCFF00]"><Edit3 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-white/10 bg-black">
          <button onClick={toggleAutoAgents} className={`w-full py-3.5 rounded text-[10px] font-bold tracking-widest border transition-all ${isAutoActive ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_15px_#CCFF0044]' : 'bg-white/5 border-white/10 text-white/40'}`}>
            {isAutoActive ? 'AGENTS_ACTIVE' : 'ACTIVATE_AGENTS'}
          </button>
        </div>
      </aside>

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" />}

      {/* CHAT PRINCIPAL - TJ OFFICE */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10 relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white/60"><Menu size={20}/></button>
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase truncate max-w-[150px] md:max-w-none">Canal: <span className="text-[#CCFF00]">#general</span></span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-[#CCFF00]/50 text-[#CCFF00]' : 'border-white/10 text-white/20'}`}>
              <Activity size={14}/>
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {mensajes.filter(m => m.canal !== '#alertas').length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center p-10">
              <Terminal size={32} />
              <p className="mt-4 text-[9px] tracking-[0.5em] font-bold uppercase">System idle: awaiting commands</p>
            </div>
          ) : (
            mensajes.filter(m => m.canal !== '#alertas').map(m => (
              <div key={m.id} className={`flex gap-3 md:gap-4 max-w-3xl mx-auto group animate-in ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-4 rounded-lg' : ''}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-[8px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0044]' : 'bg-white/10 text-white'}`}>
                  {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold text-white/60 uppercase tracking-tighter">
                      {m.remitente_tipo === 'agente' ? [...INITIAL_AGENTS, ...agentes].find(a => a.id === m.remitente_id)?.nombre : 'Operador'}
                    </span>
                    <span className="text-[7px] text-white/20">{new Date(m.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className={`text-[12px] leading-relaxed break-words ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90 font-medium' : 'text-white/80'}`}>
                    {m.texto}
                  </p>
                </div>
              </div>
            ))
          )}
          {/* INDICADOR DE ESCRITURA */}
          {isTyping && (
            <div className="flex gap-4 max-w-3xl mx-auto animate-pulse">
              <div className="flex-shrink-0 w-7 h-7 rounded bg-[#CCFF00] text-black flex items-center justify-center text-[8px] font-bold shadow-[0_0_10px_#CCFF0044]">
                AI
              </div>
              <div className="flex-1 p-4 rounded-lg bg-white/5 border border-white/5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 bg-black border-t border-white/10 relative">
          {/* MENTIONS BOX */}
          {showMentions && (
            <div className="absolute bottom-full left-4 md:left-6 mb-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-30 animate-in">
              <div className="p-2 border-b border-white/5 bg-white/5">
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest px-2">Mencionar Agente</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {agentes.filter(a => a.nickname.toLowerCase().includes(mentionFilter)).map(a => (
                  <button key={a.id} onClick={() => selectMention(a.nickname)} className="w-full flex items-center gap-3 p-2.5 hover:bg-[#CCFF00] hover:text-black transition-colors group text-left">
                    <img src={a.avatar_url} className="w-5 h-5 rounded bg-black" alt="" />
                    <div className="flex-1 min-w-0"><p className="font-bold text-[10px]">@{a.nickname}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center gap-2">
            <div className="relative flex-1">
              <input type="text" value={inputText} onChange={handleInputChange} placeholder={isSending ? "Enviando..." : "Instrucción de sistema..."} disabled={isSending} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-base md:text-[12px] text-white focus:outline-none focus:border-[#CCFF00]/50 transition-all" />
              <button type="submit" disabled={!inputText.trim() || isSending} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 transition-all"><Send size={16} /></button>
            </div>
          </form>
        </div>
      </main>

      {/* SIDEBAR DERECHA - ANYTIME FITNESS (MORADO) */}
      <aside className="w-80 flex-shrink-0 bg-[#1A0B2E] flex flex-col h-full border-l border-white/10">
        <header className="h-16 flex items-center px-6 border-b border-purple-500/20 bg-[#12071F] sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#A855F7]" />
            <span className="text-[9px] font-black tracking-[0.2em] text-purple-200 uppercase italic">ANYTIME <span className="text-white">COACHING</span></span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          <div className="flex flex-col items-center justify-center py-6 text-center border-b border-purple-500/10 mb-2">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=auditor" className="w-12 h-12 rounded-full bg-purple-900 border-2 border-purple-500 shadow-lg mb-2" alt="Auditor" />
             <p className="text-[10px] font-bold text-purple-200">@AuditorAnytime</p>
             <p className="text-[8px] text-purple-400/60 uppercase font-bold tracking-widest mt-1">Auditando Sede SP-0085</p>
          </div>

          {/* DASHBOARD DE REPORTES */}
          <div className="space-y-4">
            {!ultimoReporte ? (
                <div className="text-center p-10 opacity-30">
                  <Activity size={24} className="mx-auto text-purple-400 mb-2" />
                  <p className="text-[8px] font-bold uppercase tracking-widest">Esperando reporte...</p>
                </div>
            ) : (
                <>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">Último Reporte</span>
                    <span className="text-[7px] text-white/30">{new Date(ultimoReporte.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* CARD TOTAL */}
                  <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/20 shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-purple-200 uppercase">Total Alumnos</span>
                      <Activity size={12} className="text-purple-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{ultimoReporte.total_alumnos}</p>
                    <p className="text-[8px] text-purple-400 font-bold uppercase mt-1">Sincronizados con AF</p>
                  </div>

                  {/* SECCIONES DETALLADAS */}
                  <div className="space-y-2">
                    {/* MENSAJES PENDIENTES */}
                    <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-[8px] font-bold text-blue-200 uppercase tracking-widest">Mensajes</span>
                      </div>
                      <p className="text-[11px] text-blue-100 font-medium">{ultimoReporte.mensajes_pendientes} mensajes pendientes</p>
                    </div>

                    {/* SIN RESPUESTA */}
                    <div className="p-3 rounded-lg bg-orange-900/20 border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        <span className="text-[8px] font-bold text-orange-200 uppercase tracking-widest">Sin Respuesta / Seguimiento</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ultimoReporte.sin_respuesta.length > 0 ? ultimoReporte.sin_respuesta.map((n, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-200 text-[9px] border border-orange-500/10">{n}</span>
                        )) : <span className="text-[9px] text-orange-200/40 italic">Al día</span>}
                      </div>
                    </div>

                    {/* FALTAN ESCANEO */}
                    <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-[8px] font-bold text-red-200 uppercase tracking-widest">Faltan Escaneo Evolt</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {ultimoReporte.pendientes_escaneo.length > 0 ? ultimoReporte.pendientes_escaneo.map((n, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] text-red-100/80 p-1.5 rounded bg-red-500/5">
                            <span>{n}</span>
                            <span className="text-[7px] font-bold text-red-500/60">PENDIENTE</span>
                          </div>
                        )) : <span className="text-[9px] text-red-200/40 italic">Todos escaneados</span>}
                      </div>
                    </div>
                  </div>
                </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-purple-500/10 bg-[#12071F]">
           <div className="flex items-center gap-2 px-3 py-2 rounded bg-purple-900/30 border border-purple-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[8px] font-bold text-purple-200/60 uppercase tracking-widest">Sincronizado con Anytime Dashboard</span>
           </div>
        </div>
      </aside>
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-xl p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setEditingAgente(null)} className="absolute top-4 right-4 text-white/40"><X size={18}/></button>
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase mb-6 flex items-center gap-3"><Settings2 size={16} className="text-[#CCFF00]" /> Configurar Agente</h2>
            <div className="space-y-5">
              <div><label className="text-[8px] text-white/30 font-bold block mb-2 uppercase tracking-widest">Identificador</label><input type="text" value={editingAgente.nombre} onChange={(e) => setEditingAgente({...editingAgente, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white outline-none focus:border-[#CCFF00]/40" /></div>
              <div><label className="text-[8px] text-white/30 font-bold block mb-2 uppercase tracking-widest">Rol Sistema</label><input type="text" value={editingAgente.rol} onChange={(e) => setEditingAgente({...editingAgente, rol: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white outline-none focus:border-[#CCFF00]/40" /></div>
              <button onClick={async () => { await supabase.from('tj_agentes').update({ nombre: editingAgente.nombre, rol: editingAgente.rol }).eq('id', editingAgente.id); setEditingAgente(null); fetchData(); }} className="w-full bg-[#CCFF00] text-black font-black py-4 rounded text-[10px] tracking-widest hover:bg-white transition-all">GUARDAR CAMBIOS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

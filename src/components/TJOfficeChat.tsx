import React, { useState, useEffect, useRef } from 'react';
import { Send, Power, Edit3, Terminal, Cpu, Activity, MessageSquare, Settings2, X, Check, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal } from '../types';

const INITIAL_AGENTS: Agente[] = [
  { id: '11111111-1111-1111-1111-111111111111', nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=code', estado_online: true, creado_en: '' },
  { id: '22222222-2222-2222-2222-222222222222', nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing', estado_online: true, creado_en: '' },
  { id: '33333333-3333-3333-3333-333333333333', nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal', estado_online: true, creado_en: '' },
  { id: '44444444-4444-4444-4444-444444444444', nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=data', estado_online: true, creado_en: '' },
  { id: '55555555-5555-5555-5555-555555555555', nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy', estado_online: true, creado_en: '' }
];

export const TJOfficeChat: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>(INITIAL_AGENTS);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAutoActive, setIsAutoActive] = useState(true);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Detectar mención
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
          const agente = agentes.find(a => a.id === newMessage.remitente_id);
          speakMessage(newMessage.texto, agente?.nickname || '');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tj_agentes' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agentes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensajes]);

  const fetchData = async () => {
    try {
      const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
      if (a?.length) setAgentes(a);
      const { data: m } = await supabase.from('tj_mensajes').select('*').order('creado_en', { ascending: true });
      if (m) setMensajes(m);
    } catch (err) { console.error("Error fetching data:", err); }
  };

  const generateAgentResponse = async (agent: Agente, userText: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log(`Intentando respuesta de ${agent.nickname}...`);
    
    if (!apiKey) {
      console.error("ERROR: VITE_GEMINI_API_KEY no encontrada en el entorno.");
      return;
    }

    const prompt = `Actúa como ${agent.nombre} (@${agent.nickname}), un experto en ${agent.rol} con estas habilidades: ${agent.skills}. 
    Estamos en el canal #general de TJ Office.
    Instrucción del usuario: "${userText}".
    
    REGLAS:
    1. Responde de forma breve y directa (máximo 2 párrafos).
    2. Mantén la personalidad de tu rol.
    3. Si es una duda técnica y eres el Programador, sé muy preciso. Si eres Marketing, sé creativo.
    4. No menciones que eres una IA, actúa como el profesional que eres.
    5. Usa un tono profesional pero moderno.`;

    try {
      console.log(`Llamando a Gemini API para ${agent.nickname}...`);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        console.error("Error de la API de Gemini:", data.error);
        return;
      }

      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (aiText) {
        console.log(`Respuesta de Gemini recibida, guardando en Supabase...`);
        const { error: insertError } = await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente',
          remitente_id: agent.id,
          texto: aiText,
          canal: '#general'
        }]);

        if (insertError) {
          console.error("Error al insertar mensaje de agente en Supabase:", insertError);
        } else {
          console.log(`Mensaje de ${agent.nickname} guardado con éxito.`);
        }
      } else {
        console.warn("Gemini no devolvió texto. Data:", data);
      }
    } catch (err) {
      console.error(`Error fatal en respuesta de ${agent.nickname}:`, err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const tempText = inputText;
    
    try {
      // 1. Guardar mensaje del usuario en Supabase
      const { data, error } = await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: tempText,
        canal: '#general'
      }]).select();

      if (error) throw error;
      
      const savedMessage = data?.[0];
      if (savedMessage) {
        setMensajes(prev => prev.some(m => m.id === savedMessage.id) ? prev : [...prev, savedMessage as Mensaje]);
      }

      setInputText('');

      // 2. Respuesta individual de agentes (si está activo)
      if (isAutoActive) {
        // Elegimos 1 o 2 agentes al azar para que respondan, o los que sean mencionados
        const mentionedAgent = agentes.find(a => tempText.toLowerCase().includes(`@${a.nickname.toLowerCase()}`));
        
        if (mentionedAgent) {
          // Si mencionan a uno específico, responde ese
          setTimeout(() => generateAgentResponse(mentionedAgent, tempText), 1000);
        } else {
          // Si no, el Senior Dev responde casi siempre, y otro al azar puede unirse
          const responder1 = agentes.find(a => a.nickname === 'Programador') || agentes[0];
          setTimeout(() => generateAgentResponse(responder1, tempText), 1500);
          
          // 30% de probabilidad de que otro agente intervenga
          if (Math.random() > 0.7) {
            const others = agentes.filter(a => a.id !== responder1.id);
            const responder2 = others[Math.floor(Math.random() * others.length)];
            setTimeout(() => generateAgentResponse(responder2, tempText), 4000);
          }
        }
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
      
      {/* 1. SIDEBAR IZQUIERDA: AGENTES (Responsive) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-white/10 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
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

      {/* OVERLAY MOBILE */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" />}

      {/* 2. AREA CENTRAL: CHAT (Principal) */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10 relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white/60"><Menu size={20}/></button>
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase truncate max-w-[150px] md:max-w-none">Canal: <span className="text-[#CCFF00]">#general</span></span>
            <div className="hidden md:flex items-center gap-1.5 ml-4 px-2 py-0.5 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/20">
              <div className="w-1 h-1 rounded-full bg-[#CCFF00] animate-pulse" />
              <span className="text-[7px] font-bold text-[#CCFF00] uppercase tracking-widest">Agents Online</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-[#CCFF00]/50 text-[#CCFF00]' : 'border-white/10 text-white/20'}`}>
              <Activity size={14}/>
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center p-10">
              <Terminal size={32} />
              <p className="mt-4 text-[9px] tracking-[0.5em] font-bold uppercase">System idle: awaiting commands</p>
            </div>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex gap-3 md:gap-4 max-w-3xl mx-auto group animate-in ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-4 rounded-lg' : ''}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-[8px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0044]' : 'bg-white/10 text-white'}`}>
                  {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold text-white/60 uppercase tracking-tighter">
                      {m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Operador'}
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
        </div>

        <div className="p-4 md:p-6 bg-black border-t border-white/10 relative">
          {/* Sugerencias de Menciones */}
          {showMentions && (
            <div className="absolute bottom-full left-4 md:left-6 mb-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-2 border-b border-white/5 bg-white/5">
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest px-2">Mencionar Agente</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {agentes
                  .filter(a => a.nickname.toLowerCase().includes(mentionFilter))
                  .map(a => (
                    <button 
                      key={a.id}
                      onClick={() => selectMention(a.nickname)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-[#CCFF00] hover:text-black transition-colors group text-left"
                    >
                      <img src={a.avatar_url} className="w-5 h-5 rounded bg-black" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[10px]">@{a.nickname}</p>
                        <p className="text-[7px] text-white/40 group-hover:text-black/60 truncate uppercase font-medium">{a.rol}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={inputText}
                onChange={handleInputChange}
                placeholder={isSending ? "Enviando..." : "Instrucción de sistema... (usa @ para mencionar)"}
                disabled={isSending}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-base md:text-[12px] text-white focus:outline-none focus:border-[#CCFF00]/50 transition-all"
              />
              <button 
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
          <p className="mt-3 text-[7px] text-white/20 font-bold uppercase tracking-[0.2em] text-center hidden md:block">Connected to TJ Fitlab Mainframe</p>
        </div>
      </main>

      {/* 3. SIDEBAR DERECHA: MONITOR (Hidden on Mobile) */}
      <aside className="hidden xl:flex w-72 flex-shrink-0 bg-[#0A0A0A] flex flex-col h-full">
        <header className="h-16 flex items-center px-6 border-b border-white/10 bg-black">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-white/20" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Monitorización</span>
          </div>
        </header>
        <div className="flex-1 p-6 space-y-6">
          <div className="p-6 border border-white/5 rounded-lg bg-white/[0.01] flex flex-col items-center justify-center gap-4 text-center">
            <Terminal size={24} className="text-white/10" />
            <span className="text-[9px] font-bold tracking-widest text-white/60 uppercase">System Ready</span>
          </div>
          <div className="space-y-4">
            <div className="p-4 border border-white/5 rounded-lg">
              <div className="flex justify-between text-[8px] mb-2 font-bold uppercase text-white/40"><span>Traffic</span><Activity size={10} className="text-[#CCFF00]"/></div>
              <div className="h-1 bg-white/5 rounded-full"><div className="bg-[#CCFF00] h-full w-[12%]" /></div>
            </div>
          </div>
        </div>
      </aside>

      {/* MODAL EDITAR (Responsive) */}
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-xl p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setEditingAgente(null)} className="absolute top-4 right-4 text-white/40"><X size={18}/></button>
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
              <Settings2 size={16} className="text-[#CCFF00]" /> Configurar Agente
            </h2>
            <div className="space-y-5">
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-2 uppercase tracking-widest">Identificador</label>
                <input type="text" value={editingAgente.nombre} onChange={(e) => setEditingAgente({...editingAgente, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white outline-none focus:border-[#CCFF00]/40" />
              </div>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-2 uppercase tracking-widest">Rol Sistema</label>
                <input type="text" value={editingAgente.rol} onChange={(e) => setEditingAgente({...editingAgente, rol: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-3 text-base md:text-xs text-white outline-none focus:border-[#CCFF00]/40" />
              </div>
              <button onClick={async () => {
                await supabase.from('tj_agentes').update({ nombre: editingAgente.nombre, rol: editingAgente.rol }).eq('id', editingAgente.id);
                setEditingAgente(null);
                fetchData();
              }} className="w-full bg-[#CCFF00] text-black font-black py-4 rounded text-[10px] tracking-widest hover:bg-white transition-all">GUARDAR CAMBIOS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

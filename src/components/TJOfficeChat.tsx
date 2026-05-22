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
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speakMessage = (text: string, nickname: string) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    const cleanText = text.replace(/@\w+/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    if (nickname === 'Programador') { utterance.pitch = 0.8; }
    window.speechSynthesis.speak(utterance);
  };

  const fetchData = async () => {
    try {
      const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
      if (a?.length) setAgentes(a);
      const { data: m } = await supabase.from('tj_mensajes').select('*').order('creado_en', { ascending: true });
      if (m) setMensajes(m);
    } catch (err) { console.error("Error fetching data:", err); }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('tj-office-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tj_mensajes' }, (payload) => {
        const newMessage = payload.new as Mensaje;
        setMensajes(prev => prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage]);
        if (newMessage.remitente_tipo === 'agente') {
          const agente = [...INITIAL_AGENTS, ...agentes].find(a => a.id === newMessage.remitente_id);
          speakMessage(newMessage.texto, agente?.nickname || '');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agentes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensajes]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const userText = inputText;
    setInputText('');

    try {
      // 1. GUARDAR MENSAJE USUARIO
      const { data, error } = await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: userText,
        canal: '#general'
      }]).select();

      if (error) throw error;
      if (data?.[0]) setMensajes(prev => [...prev, data[0] as Mensaje]);

      // 2. RESPUESTA IA (SI ESTÁ ACTIVO)
      if (isAutoActive) {
        setIsTyping("ALL");
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const agent = agentes[Math.floor(Math.random() * agentes.length)];

        let aiText = "¡Hola jefe! Estoy operativo y a sus órdenes. Mi sistema Gemini Flash está listo.";

        if (apiKey) {
          try {
            const prompt = `Eres ${agent.nombre}, experto en ${agent.rol}. 
            Skills: ${agent.skills}. 
            SIEMPRE saluda diciendo "¡Hola jefe!" o "¡Hola, buenos días, jefe!". 
            Dime qué hacemos hoy y dame una noticia técnica de tu área. 
            El usuario dijo: "${userText}"`;

            // USANDO GEMINI 1.5 FLASH (EL MÁS BARATO Y COMPATIBLE)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const resData = await response.json();
            if (response.ok && resData.candidates?.[0]?.content?.parts?.[0]?.text) {
              aiText = resData.candidates[0].content.parts[0].text;
            } else {
              console.error("API Error:", resData);
              aiText = `¡Hola jefe! El mainframe reporta una respuesta inusual de la IA, pero sigo a sus órdenes. (Error: ${resData.error?.status || 'API_FAIL'})`;
            }
          } catch (e) {
            console.error("Fetch Gemini Error:", e);
          }
        }

        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente',
          remitente_id: agent.id,
          texto: aiText,
          canal: '#general'
        }]);
        setIsTyping(null);
      }
    } catch (err: any) {
      alert("Error de conexión: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden text-[12px]">
      
      {/* 1. SIDEBAR IZQUIERDA: AGENTES */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-white/10 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/logo-tjo.jpg" className="w-8 h-8 rounded border border-[#CCFF00]/30" alt="TJO" />
            <span className="font-black tracking-tighter text-sm italic uppercase">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/40"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="text-[9px] font-bold text-white/40 tracking-[0.2em] uppercase">Especialistas IA</span>
          <div className="space-y-2">
            {agentes.map(a => (
              <div key={a.id} className="group p-2.5 rounded bg-white/5 border border-white/5 hover:border-[#CCFF00]/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={a.avatar_url} className="w-7 h-7 rounded bg-black" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black bg-[#CCFF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[10px] truncate">@{a.nickname}</p>
                    <p className="text-[8px] text-white/40 truncate uppercase">{a.rol}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => setIsAutoActive(!isAutoActive)} className={`w-full py-3.5 rounded text-[10px] font-bold tracking-widest border transition-all ${isAutoActive ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_10px_#CCFF0044]' : 'bg-white/5 border-white/10 text-white/40'}`}>
            {isAutoActive ? 'AGENTS_ACTIVE' : 'ACTIVATE_AGENTS'}
          </button>
        </div>
      </aside>

      {/* 2. CHAT CENTRAL: FOCO TOTAL */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10 relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white/60"><Menu size={18}/></button>
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Panel Central de Instrucciones</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] text-[8px] font-black border border-[#CCFF00]/20 uppercase">v1.5-FLASH</span>
          </div>
          <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-[#CCFF00]/50 text-[#CCFF00]' : 'border-white/10 text-white/20'}`}>
            <Activity size={14}/>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <Terminal size={32} />
              <p className="mt-4 text-[9px] tracking-[0.5em] font-bold uppercase">Awaiting commands, Jefe...</p>
            </div>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex gap-4 max-w-3xl mx-auto animate-in ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-4 rounded-lg' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-[9px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0044]' : 'bg-white/10 text-white'}`}>
                  {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-white/60 uppercase">
                      {m.remitente_tipo === 'agente' ? [...INITIAL_AGENTS, ...agentes].find(a => a.id === m.remitente_id)?.nombre : 'Operador'}
                    </span>
                    <span className="text-[7px] text-white/20">{new Date(m.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className={`text-[12px] leading-relaxed break-words ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90' : 'text-white/80'}`}>{m.texto}</p>
                </div>
              </div>
            ))
          )}
          {isTyping && <div className="flex gap-4 max-w-3xl mx-auto animate-pulse"><div className="flex-shrink-0 w-8 h-8 rounded bg-[#CCFF00] text-black flex items-center justify-center text-[8px] font-bold">AI</div><div className="flex-1 p-4 rounded-lg bg-white/5 border border-white/5"><div className="flex gap-1"><span className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce" /><span className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce [animation-delay:0.2s]" /><span className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce [animation-delay:0.4s]" /></div></div></div>}
        </div>

        <div className="p-4 md:p-6 bg-black border-t border-white/10">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Instrucción de sistema..." disabled={isSending} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-5 pr-14 text-base md:text-[12px] text-white focus:outline-none focus:border-[#CCFF00]/50 transition-all" />
            <button type="submit" disabled={!inputText.trim() || isSending} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-20"><Send size={16} /></button>
          </form>
        </div>
      </main>

      {/* 3. SIDEBAR DERECHA: MONITOR */}
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
            <span className="text-[9px] font-bold tracking-widest text-white/60 uppercase italic">Mainframe Ready</span>
          </div>
          <div className="p-4 border border-white/5 rounded-lg">
            <div className="flex justify-between text-[8px] mb-2 font-bold uppercase text-white/40"><span>Uptime</span><Activity size={10} className="text-[#CCFF00]"/></div>
            <div className="h-1 bg-white/5 rounded-full"><div className="bg-[#CCFF00] h-full w-[95%] shadow-[0_0_5px_#CCFF00]" /></div>
          </div>
        </div>
      </aside>
    </div>
  );
};

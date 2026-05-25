import React, { useState, useEffect, useRef } from 'react';
import { Send, Power, Edit3, Terminal, Cpu, Activity, MessageSquare, Settings2, X, Check, Menu, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal, ReporteGym } from '../types';

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
  const [ultimoReporte, setUltimoReporte] = useState<ReporteGym | null>(null);
  const [inputText, setInputText] = useState('');
  const [isAutoActive, setIsAutoActive] = useState(true);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speakMessage = (text: string, nickname: string) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/@\w+/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      if (nickname === 'Programador') { utterance.pitch = 0.8; }
      window.speechSynthesis.speak(utterance);
    } catch (e) { console.warn("TTS Error"); }
  };

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
      if (a?.length) setAgentes(a);
      
      const { data: m } = await supabase
        .from('tj_mensajes')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(50);
      if (m) setMensajes(m.reverse());
      
      const { data: r } = await supabase.from('tj_reportes').select('*').order('creado_en', { ascending: false }).limit(1);
      if (r?.[0]) setUltimoReporte(r[0]);
    } catch (err) { console.error("Sync Error:", err); }
    finally { setIsSyncing(false); }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('tj-office-ultra-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tj_mensajes' }, (payload) => {
        const newMessage = payload.new as Mensaje;
        setMensajes(prev => prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage]);
        if (newMessage.remitente_tipo === 'agente') {
          const agent = [...INITIAL_AGENTS, ...agentes].find(a => a.id === newMessage.remitente_id);
          speakMessage(newMessage.texto, agent?.nickname || '');
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
  }, [mensajes, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userText = inputText;
    setInputText('');
    setIsSending(true);

    try {
      const { data, error } = await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: userText,
        canal: '#general'
      }]).select();

      if (error) throw error;
      if (data?.[0]) setMensajes(prev => [...prev, data[0] as Mensaje]);

      if (isAutoActive) {
        setIsTyping("ALL");
        const generateResponse = async () => {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          const randomAgent = agentes[Math.floor(Math.random() * agentes.length)] || agentes[0];
          let responseText = "¡Hola jefe! El sistema ha detectado una pequeña latencia, pero sigo operativo.";

          try {
            if (apiKey) {
              const prompt = `Eres ${randomAgent.nombre}, experto en ${randomAgent.rol}. SIEMPRE di "¡Hola jefe!" al inicio. Dime qué hacemos hoy. Usuario: "${userText}"`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000);

              const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              const resJson = await res.json();
              if (res.ok && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                responseText = resJson.candidates[0].content.parts[0].text;
              }
            }
            await supabase.from('tj_mensajes').insert([{
              remitente_tipo: 'agente',
              remitente_id: randomAgent.id,
              texto: responseText,
              canal: '#general'
            }]);
          } catch (aiErr) { console.error("AI Error:", aiErr); }
          finally { setIsTyping(null); }
        };
        generateResponse();
      }
    } catch (err: any) { alert("Mainframe Error. Reloading..."); }
    finally { setIsSending(false); }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden text-[12px]">
      
      {/* SIDEBAR IZQUIERDA: AGENTES */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-white/10 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 bg-black">
          <div className="flex items-center gap-3">
            <img src="/logo-tjo.jpg" className="w-8 h-8 rounded border border-[#CCFF00]/30 shadow-[0_0_10px_#CCFF0044]" alt="TJO" />
            <span className="font-black tracking-tighter text-sm italic uppercase italic">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/40"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="text-[9px] font-bold text-white/40 tracking-[0.2em] uppercase px-1">Especialistas IA</span>
          <div className="space-y-2">
            {agentes.map(a => (
              <div key={a.id} className="group p-2.5 rounded bg-white/5 border border-white/5 hover:border-[#CCFF00]/30 transition-all cursor-default">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img src={a.avatar_url} className="w-7 h-7 rounded bg-black" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black bg-[#CCFF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[10px] truncate">@{a.nickname}</p>
                    <p className="text-[8px] text-white/40 truncate uppercase font-medium">{a.rol}</p>
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

      {/* ÁREA CENTRAL: CHAT */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10 relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white/60"><Menu size={18}/></button>
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Control Central</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] text-[8px] font-black border border-[#CCFF00]/20 uppercase tracking-widest">v1.7-ULTRA</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className={`p-2 text-white/40 hover:text-white transition-all ${isSyncing ? 'animate-spin text-[#CCFF00]' : ''}`}><RefreshCw size={14}/></button>
            <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-[#CCFF00]/50 text-[#CCFF00]' : 'border-white/10 text-white/20'}`}><Activity size={14}/></button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {mensajes.length === 0 && !isSyncing ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10"><Terminal size={32} /><p className="mt-4 text-[9px] tracking-[0.5em] font-bold uppercase">Awaiting commands, Jefe...</p></div>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex gap-4 max-w-3xl mx-auto animate-in ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-4 rounded-lg' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-[9px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black' : 'bg-white/10 text-white'}`}>
                  {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-white/60 uppercase">{m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Operador'}</span>
                    <span className="text-[7px] text-white/20">{new Date(m.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className={`text-[12px] leading-relaxed break-words ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90 font-medium' : 'text-white/80'}`}>{m.texto}</p>
                </div>
              </div>
            ))
          )}
          {isTyping && <div className="flex gap-4 max-w-3xl mx-auto animate-pulse"><div className="flex-shrink-0 w-8 h-8 rounded bg-[#CCFF00] text-black flex items-center justify-center text-[8px] font-bold shadow-[0_0_8px_#CCFF00]">AI</div><div className="flex-1 p-4 rounded-lg bg-white/5 border border-white/5"><div className="flex gap-1"><span className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce" /><span className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce [animation-delay:0.2s]" /><span className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce [animation-delay:0.4s]" /></div></div></div>}
        </div>

        <div className="p-4 md:p-6 bg-black border-t border-white/10">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Instrucción de sistema..." disabled={isSending} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-5 pr-14 text-base md:text-[12px] text-white focus:outline-none focus:border-[#CCFF00]/50 transition-all" />
            <button type="submit" disabled={!inputText.trim() || isSending} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-20 transition-all shadow-[0_0_15px_#CCFF0044]"><Send size={16}/></button>
          </form>
        </div>
      </main>

      {/* SIDEBAR DERECHA: ANYTIME COACHING */}
      <aside className="hidden xl:flex w-80 flex-shrink-0 bg-[#1A0B2E] flex flex-col h-full border-l border-white/10">
        <header className="h-16 flex items-center px-6 border-b border-purple-500/20 bg-[#12071F] sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#A855F7]" />
            <span className="text-[9px] font-black tracking-[0.2em] text-purple-200 uppercase italic">ANYTIME <span className="text-white">COACHING</span></span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide text-center">
          <div className="py-6 border-b border-purple-500/10 mb-4">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=auditor" className="w-16 h-16 rounded-full bg-purple-900 border-2 border-purple-500 shadow-xl mx-auto mb-3" alt="Auditor" />
             <p className="text-[11px] font-bold text-purple-100 tracking-tight">@AuditorAnytime</p>
             <p className="text-[8px] text-purple-400 font-bold uppercase tracking-widest mt-1">Status: Monitoring SP-0085</p>
          </div>

          <div className="space-y-4">
            {!ultimoReporte ? (
              <div className="p-10 opacity-30 flex flex-col items-center">
                <Activity size={24} className="text-purple-400 mb-2" />
                <p className="text-[8px] font-bold uppercase tracking-widest text-purple-200">Waiting for feed...</p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/20 shadow-inner">
                  <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-purple-300 uppercase"><span>Total Alumnos</span><Activity size={12} /></div>
                  <p className="text-3xl font-black text-white text-left">{ultimoReporte.total_alumnos}</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-500/20">
                  <p className="text-[8px] font-bold text-orange-400 uppercase text-left mb-2 tracking-widest">Pendientes</p>
                  <p className="text-xl font-bold text-orange-100 text-left">{ultimoReporte.mensajes_pendientes}</p>
                </div>
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20">
                   <p className="text-[8px] font-bold text-red-400 uppercase text-left mb-2 tracking-widest uppercase italic">Escaneos Requeridos</p>
                   <div className="max-h-32 overflow-y-auto space-y-1 text-left">
                      {(ultimoReporte.pendientes_escaneo || []).map((n, i) => (<div key={i} className="text-[10px] text-red-100 flex justify-between border-b border-white/5 pb-1"><span>{n}</span><span className="text-[8px] text-red-500 font-black">!</span></div>))}
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-purple-500/10 bg-[#12071F] flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22C55E]" />
           <span className="text-[7px] text-purple-300 font-bold uppercase tracking-[0.2em]">Data Pipeline: Operational</span>
        </div>
      </aside>
    </div>
  );
};

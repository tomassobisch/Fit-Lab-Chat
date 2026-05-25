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

// DATA DEFAULT PARA QUE NUNCA SE VEA VACÍO EL PANEL
const MOCK_REPORTE: ReporteGym = {
    id: 'mock',
    total_alumnos: 142,
    mensajes_pendientes: 12,
    pendientes_escaneo: ['Juan Perez', 'Maria Garcia', 'Carlos Ruiz'],
    creado_en: new Date().toISOString()
};

export const TJOfficeChat: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>(INITIAL_AGENTS);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [ultimoReporte, setUltimoReporte] = useState<ReporteGym>(MOCK_REPORTE);
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
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userText = inputText;
    setInputText('');
    setIsSending(true);

    // EMERGENCY UNLOCK: Si en 5 segundos no ha terminado, liberamos la barra
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

        if (apiKey) {
           try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `Eres ${agent.nombre}. SIEMPRE di "¡Hola jefe!" al inicio. Responde a: ${userText}` }] }] })
              });
              const resJson = await res.json();
              if (res.ok) aiText = resJson.candidates[0].content.parts[0].text;
           } catch (e) {}
        }

        await supabase.from('tj_mensajes').insert([{
          remitente_tipo: 'agente', remitente_id: agent.id, texto: aiText, canal: '#general'
        }]);
        setIsTyping(null);
      }
    } catch (err) {}
    finally { setIsSending(false); }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden text-[12px]">
      
      {/* SIDEBAR IZQUIERDA: AGENTES */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-white/10 flex flex-col lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform`}>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <img src="/logo-tjo.jpg" className="w-8 h-8 rounded border border-[#CCFF00]/30 shadow-[0_0_10px_#CCFF0044]" alt="" />
          <span className="font-black italic">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">Especialistas IA</span>
          {agentes.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded bg-white/5 border border-white/5">
              <div className="relative"><img src={a.avatar_url} className="w-7 h-7 rounded bg-black" /><div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#CCFF00]" /></div>
              <div className="flex-1 min-w-0"><p className="font-bold text-[10px] truncate">@{a.nickname}</p><p className="text-[8px] text-white/40 truncate uppercase">{a.rol}</p></div>
              <button onClick={() => setEditingAgente(a)} className="text-white/20 hover:text-[#CCFF00]"><Edit3 size={12}/></button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => setIsAutoActive(!isAutoActive)} className={`w-full py-3 rounded text-[10px] font-bold border transition-all ${isAutoActive ? 'bg-[#CCFF00] text-black border-[#CCFF00]' : 'bg-white/5 text-white/40'}`}>
            {isAutoActive ? 'AGENTS_ACTIVE' : 'ACTIVATE_AGENTS'}
          </button>
        </div>
      </aside>

      {/* CHAT CENTRAL */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10 relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden"><Menu size={18}/></button>
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Mainframe</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] text-[8px] font-black border border-[#CCFF00]/20">v1.8-ULTRA_STABLE</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className={`p-2 ${isSyncing ? 'animate-spin text-[#CCFF00]' : 'text-white/40'}`}><RefreshCw size={14}/></button>
            <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border ${isVoiceEnabled ? 'border-[#CCFF00] text-[#CCFF00]' : 'border-white/10 text-white/20'}`}><Activity size={14}/></button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
          {mensajes.map(m => (
            <div key={m.id} className={`flex gap-3 max-w-3xl mx-auto ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-3 rounded-lg' : ''}`}>
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black' : 'bg-white/10 text-white'}`}>{m.remitente_tipo === 'agente' ? 'AI' : 'OP'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-white/40 uppercase mb-1">{m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Jefe'}</p>
                <p className={`text-[12px] leading-relaxed break-words ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90' : 'text-white/80'}`}>{m.texto}</p>
              </div>
            </div>
          ))}
          {isTyping && <div className="flex gap-3 max-w-3xl mx-auto"><div className="w-6 h-6 rounded bg-[#CCFF00] text-black flex items-center justify-center text-[8px] font-bold">...</div><div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5 animate-pulse">Pensando...</div></div>}
        </div>

        <div className="p-4 md:p-6 bg-black border-t border-white/10">
          <form onSubmit={handleSend} className="max-w-2xl mx-auto relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Instrucción inmediata..." disabled={isSending} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-base md:text-[12px] text-white focus:border-[#CCFF00]/50 outline-none" />
            <button type="submit" disabled={!inputText.trim() || isSending} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center transition-all"><Send size={16}/></button>
          </form>
        </div>
      </main>

      {/* SIDEBAR DERECHA: ANYTIME */}
      <aside className="hidden xl:flex w-80 flex-shrink-0 bg-[#1A0B2E] flex flex-col h-full border-l border-white/10">
        <header className="h-16 flex items-center px-6 border-b border-purple-500/20 bg-[#12071F]">
           <span className="text-[9px] font-black text-purple-200 uppercase tracking-widest italic">ANYTIME <span className="text-white">COACHING</span></span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/20 text-center">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=auditor" className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-900 border border-purple-500" />
              <p className="text-[10px] font-bold text-white">Auditor Activo</p>
              <p className="text-[7px] text-purple-400 uppercase tracking-tighter mt-1">Conectado a SP-0085</p>
           </div>
           <div className="grid grid-cols-1 gap-3">
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20"><p className="text-[8px] font-bold text-purple-400 uppercase mb-1">Total Alumnos</p><p className="text-2xl font-black text-white">{ultimoReporte.total_alumnos}</p></div>
              <div className="p-4 rounded-xl bg-orange-950/10 border border-orange-500/20"><p className="text-[8px] font-bold text-orange-400 uppercase mb-1">Pendientes</p><p className="text-xl font-bold text-orange-100">{ultimoReporte.mensajes_pendientes}</p></div>
              <div className="p-4 rounded-xl bg-red-950/10 border border-red-500/20">
                 <p className="text-[8px] font-bold text-red-400 uppercase mb-2 italic">Alertas de Escaneo</p>
                 <div className="space-y-1">
                    {(ultimoReporte.pendientes_escaneo || []).map((n, i) => (<div key={i} className="text-[9px] text-red-100 flex justify-between border-b border-white/5"><span>{n}</span><span className="text-red-500 font-black">!</span></div>))}
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* MODAL CONFIGURACIÓN */}
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-xl p-8 shadow-2xl relative">
            <button onClick={() => setEditingAgente(null)} className="absolute top-4 right-4 text-white/40"><X size={16}/></button>
            <div className="flex items-center gap-3 mb-6"><Settings2 size={16} className="text-[#CCFF00]" /><h2 className="text-xs font-bold uppercase">Configurar Especialista</h2></div>
            <div className="space-y-4">
              <div><label className="text-[8px] text-white/30 font-bold block mb-1 uppercase">Identificador</label><input type="text" value={editingAgente.nombre} onChange={(e) => setEditingAgente({...editingAgente, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white" /></div>
              <div><label className="text-[8px] text-white/30 font-bold block mb-1 uppercase">Rol</label><input type="text" value={editingAgente.rol} onChange={(e) => setEditingAgente({...editingAgente, rol: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white" /></div>
              <button onClick={async () => { await supabase.from('tj_agentes').update({ nombre: editingAgente.nombre, rol: editingAgente.rol }).eq('id', editingAgente.id); setEditingAgente(null); fetchData(); }} className="w-full bg-[#CCFF00] text-black font-black py-3 rounded text-[10px] hover:bg-white transition-all">APLICAR CAMBIOS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

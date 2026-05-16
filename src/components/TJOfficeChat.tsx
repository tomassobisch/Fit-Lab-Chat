import React, { useState, useEffect, useRef } from 'react';
import { Send, Power, Edit3, Terminal, Cpu, Activity, MessageSquare, Settings2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal } from '../types';

const INITIAL_AGENTS: Agente[] = [
  { id: '1', nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=code', estado_online: true, creado_en: '' },
  { id: '2', nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing', estado_online: true, creado_en: '' },
  { id: '3', nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal', estado_online: true, creado_en: '' },
  { id: '4', nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=data', estado_online: true, creado_en: '' },
  { id: '5', nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy', estado_online: true, creado_en: '' }
];

export const TJOfficeChat: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>(INITIAL_AGENTS);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    
    // Escuchar mensajes en tiempo real
    const msgSub = supabase
      .channel('tj-realtime-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tj_mensajes' }, (payload) => {
        setMensajes(prev => [...prev, payload.new as Mensaje]);
      })
      .subscribe();

    // Escuchar cambios en agentes (por si los editas desde otra pestaña)
    const agentSub = supabase
      .channel('tj-realtime-agents')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tj_agentes' }, fetchData)
      .subscribe();

    return () => { 
      supabase.removeChannel(msgSub); 
      supabase.removeChannel(agentSub);
    };
  }, []);

  const fetchData = async () => {
    const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
    if (a?.length) setAgentes(a);
    
    const { data: m } = await supabase.from('tj_mensajes').select('*').order('creado_en', { ascending: true });
    if (m) setMensajes(m);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const { error } = await supabase.from('tj_mensajes').insert([{
      remitente_tipo: 'usuario',
      remitente_id: '00000000-0000-0000-0000-000000000000',
      texto: inputText,
      canal: '#general'
    }]);

    if (!error) setInputText('');
    else console.error("Error al enviar:", error);
  };

  const saveAgentChanges = async () => {
    if (!editingAgente) return;
    const { error } = await supabase
      .from('tj_agentes')
      .update({
        nombre: editingAgente.nombre,
        rol: editingAgente.rol,
        skills: editingAgente.skills
      })
      .eq('id', editingAgente.id);
    
    if (!error) {
      setEditingAgente(null);
      fetchData();
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#000000] text-[#FFFFFF] font-sans overflow-hidden text-[12px]">
      
      {/* 1. SIDEBAR IZQUIERDA: AGENTES (Ancho Fijo) */}
      <aside className="w-60 flex-shrink-0 bg-[#0A0A0A] border-r border-white/10 flex flex-col h-full">
        <div className="h-14 flex items-center px-5 border-b border-white/10">
          <span className="font-black tracking-tighter text-sm italic">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[9px] font-bold text-white/40 tracking-[0.2em] uppercase">Specialists</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          </div>
          
          <div className="space-y-2">
            {agentes.map(a => (
              <div key={a.id} className="group p-2 rounded bg-white/5 border border-white/5 hover:border-[#CCFF00]/30 transition-all cursor-default">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img src={a.avatar_url} className="w-7 h-7 rounded bg-black" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black bg-[#CCFF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[10px] truncate">@{a.nickname}</p>
                    <p className="text-[8px] text-white/40 truncate uppercase font-medium">{a.rol}</p>
                  </div>
                  <button onClick={() => setEditingAgente(a)} className="text-white/20 hover:text-[#CCFF00]">
                    <Edit3 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-black border-t border-white/10">
          <button 
            onClick={() => setIsAutoActive(!isAutoActive)}
            className={`w-full py-3 rounded text-[9px] font-bold tracking-widest transition-all border ${
              isAutoActive 
                ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.3)]' 
                : 'bg-transparent text-white/40 border-white/10 hover:border-[#CCFF00] hover:text-[#CCFF00]'
            }`}
          >
            {isAutoActive ? 'AGENTS_ACTIVE' : 'ACTIVATE_AGENTS'}
          </button>
        </div>
      </aside>

      {/* 2. AREA CENTRAL: WORKSPACE (Flexible) */}
      <main className="flex-1 flex flex-col bg-black overflow-hidden">
        <header className="h-14 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-white/20" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">System / Primary_Monitor</span>
          </div>
        </header>
        
        <div className="flex-1 flex flex-col items-center justify-center p-10 relative">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#CCFF00 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <Terminal size={40} className="text-white/10 mb-4" />
          <h2 className="text-sm font-bold tracking-[0.5em] text-white/20 uppercase">Awaiting instruction...</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-lg opacity-40">
            <div className="h-24 border border-white/10 rounded flex flex-col items-center justify-center gap-2">
              <Activity size={16} />
              <span className="text-[8px] tracking-widest font-bold">CORE_LOAD: 2%</span>
            </div>
            <div className="h-24 border border-white/10 rounded flex flex-col items-center justify-center gap-2">
              <Activity size={16} />
              <span className="text-[8px] tracking-widest font-bold">LATENCY: 12ms</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. SIDEBAR DERECHA: CHAT INSTRUCCIONES (Ancho Fijo 360px) */}
      <aside className="w-96 flex-shrink-0 bg-[#0A0A0A] border-l border-white/10 flex flex-col h-full">
        <header className="h-14 flex items-center px-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase">Control_Interface</span>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <Terminal size={24} />
              <p className="mt-2 text-[10px] tracking-widest">NO_LOGS_DETECTED</p>
            </div>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.remitente_tipo === 'agente' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black' : 'bg-white/10 text-white'}`}>
                  {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
                </div>
                <div className={`max-w-[85%] p-3 rounded bg-white/5 border border-white/5 text-[11px] leading-relaxed ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/80' : 'text-white/90'}`}>
                  {m.texto}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-black border-t border-white/10">
          <form onSubmit={handleSend} className="relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="System command..."
              className="w-full bg-[#111] border border-white/10 rounded py-3 pl-4 pr-10 text-[11px] text-white focus:outline-none focus:border-[#CCFF00]/50 transition-all placeholder:text-white/10"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-[#CCFF00]">
              <Send size={14} />
            </button>
          </form>
          <p className="mt-2 text-[7px] text-white/20 font-bold uppercase tracking-widest text-center">Sync status: Connected to Supabase Mainframe</p>
        </div>
      </aside>

      {/* MODAL CONFIGURACIÓN AGENTE */}
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded p-8 shadow-2xl relative">
            <button onClick={() => setEditingAgente(null)} className="absolute top-4 right-4 text-white/20 hover:text-white">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-8">
              <Settings2 size={16} className="text-[#CCFF00]" />
              <h2 className="text-xs font-bold tracking-[0.2em] uppercase">Configure Agent</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-2 tracking-widest uppercase">Agent Name</label>
                <input 
                  type="text" 
                  value={editingAgente.nombre} 
                  onChange={(e) => setEditingAgente({...editingAgente, nombre: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-xs text-white focus:border-[#CCFF00]/40 outline-none" 
                />
              </div>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-2 tracking-widest uppercase">System Role</label>
                <input 
                  type="text" 
                  value={editingAgente.rol} 
                  onChange={(e) => setEditingAgente({...editingAgente, rol: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-xs text-white focus:border-[#CCFF00]/40 outline-none" 
                />
              </div>
              <button 
                onClick={saveAgentChanges}
                className="w-full bg-[#CCFF00] text-black font-black py-4 rounded text-[10px] tracking-widest hover:bg-white transition-all"
              >
                APPLY CHANGES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

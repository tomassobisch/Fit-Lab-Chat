import React, { useState, useEffect, useRef } from 'react';
import { Send, AtSign, Hash, Settings2, Power, Edit3, Check, X, Search, Terminal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal } from '../types';

// --- Sub-component: Agent Card ---
const AgentCard: React.FC<{ 
  agente: Agente, 
  onEdit: (a: Agente) => void 
}> = ({ agente, onEdit }) => {
  return (
    <div className="group relative bg-tj-graphite/30 border border-white/5 p-4 rounded-lg hover:border-tj-accent/30 transition-all">
      <div className="flex items-start gap-3">
        <div className="relative">
          <img src={agente.avatar_url} className="w-10 h-10 rounded bg-tj-dark border border-white/10" alt="" />
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-tj-panel ${agente.estado_online ? 'bg-tj-accent shadow-[0_0_8px_rgba(204,255,0,0.5)]' : 'bg-white/20'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-white truncate">@{agente.nickname}</h3>
          <p className="text-[10px] text-white/40 truncate">{agente.rol}</p>
        </div>
        <button 
          onClick={() => onEdit(agente)}
          className="text-white/20 hover:text-tj-accent transition-colors"
        >
          <Edit3 size={14} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {agente.skills.split(',').slice(0, 3).map((skill, i) => (
          <span key={i} className="text-[8px] bg-white/5 text-white/60 px-1.5 py-0.5 rounded uppercase tracking-tighter">
            {skill.trim()}
          </span>
        ))}
      </div>
    </div>
  );
};

// --- Main Chat View ---
export const TJOfficeChat: React.FC = () => {
  const [canal, setCanal] = useState<Canal>('#general');
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [inputText, setInputText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgentes();
    fetchMensajes();

    const msgSub = supabase
      .channel('tj-office-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_oficina' }, (payload) => {
        setMensajes(prev => [...prev, payload.new as Mensaje]);
      })
      .subscribe();

    const agentSub = supabase
      .channel('tj-agents-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agentes' }, () => {
        fetchAgentes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(agentSub);
    };
  }, [canal]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  const fetchAgentes = async () => {
    const { data } = await supabase.from('agentes').select('*').order('creado_en', { ascending: true });
    if (data) setAgentes(data);
  };

  const fetchMensajes = async () => {
    const { data } = await supabase.from('mensajes_oficina').select('*').eq('canal', canal).order('creado_en', { ascending: true });
    if (data) setMensajes(data);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const { error } = await supabase.from('mensajes_oficina').insert([{
      canal,
      remitente_tipo: 'usuario',
      remitente_id: '00000000-0000-0000-0000-000000000000',
      texto: inputText,
    }]);
    if (!error) setInputText('');
  };

  const updateAgente = async () => {
    if (!editingAgente) return;
    const { error } = await supabase.from('agentes').update({
      nombre: editingAgente.nombre,
      rol: editingAgente.rol,
      skills: editingAgente.skills
    }).eq('id', editingAgente.id);
    if (!error) setEditingAgente(null);
  };

  return (
    <div className="flex h-screen bg-tj-dark text-white font-sans selection:bg-tj-accent selection:text-tj-dark overflow-hidden">
      
      {/* Columna Izquierda: Agentes (Más pequeña) */}
      <aside className="w-72 bg-tj-panel border-r border-white/5 flex flex-col h-full z-20">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2">
            TJ<span className="text-tj-accent underline underline-offset-4">OFFICE</span>
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">IA SPECIALISTS</h2>
              <span className="text-[10px] bg-tj-accent/10 text-tj-accent px-1.5 py-0.5 rounded font-bold">5 ACTIVE</span>
            </div>
            <div className="space-y-3">
              {agentes.map(agente => (
                <AgentCard key={agente.id} agente={agente} onEdit={setEditingAgente} />
              ))}
            </div>
          </div>

          <button 
            onClick={() => setIsAutoActive(!isAutoActive)}
            className={`w-full group relative flex items-center justify-center gap-3 py-4 rounded-lg border transition-all duration-500 overflow-hidden ${
              isAutoActive 
                ? 'bg-tj-accent/10 border-tj-accent shadow-[0_0_20px_rgba(204,255,0,0.1)]' 
                : 'bg-white/5 border-white/10 hover:border-tj-accent/50 hover:bg-white/10'
            }`}
          >
            <div className={`absolute inset-0 bg-tj-accent/5 transition-transform duration-1000 ${isAutoActive ? 'translate-x-0' : '-translate-x-full'}`} />
            <Power size={18} className={isAutoActive ? 'text-tj-accent animate-pulse' : 'text-white/40'} />
            <span className={`text-xs font-bold tracking-widest uppercase transition-colors ${isAutoActive ? 'text-tj-accent' : 'text-white/60 group-hover:text-white'}`}>
              {isAutoActive ? 'AGENTES ACTIVOS' : 'ACTIVAR AGENTES'}
            </span>
          </button>
        </div>
      </aside>

      {/* Columna Central: Chat (Instrucciones) */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0F0F0F] relative">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-tj-dark/60 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-tj-accent animate-pulse" />
            <h2 className="text-sm font-bold tracking-tight uppercase">Control Central de Instrucciones</h2>
            <div className="h-4 w-[px] bg-white/10 mx-2" />
            <div className="flex items-center gap-2 text-[10px] text-white/30">
              <Terminal size={12} />
              <span className="font-mono">SYS_READY_V2.0</span>
            </div>
          </div>
          <div className="flex gap-2">
            {(['#general', '#desarrollo', '#marketing'] as Canal[]).map(c => (
              <button 
                key={c}
                onClick={() => setCanal(c)}
                className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${canal === c ? 'bg-tj-accent text-tj-dark' : 'text-white/40 hover:bg-white/5'}`}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 space-y-6 scrollbar-thin scrollbar-thumb-white/5">
          {mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-10">
              <Hash size={80} />
              <p className="mt-4 font-bold tracking-widest">AWAITING INSTRUCTIONS</p>
            </div>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex gap-6 max-w-4xl mx-auto ${m.remitente_tipo === 'agente' ? 'bg-white/5 p-6 rounded-lg border border-white/5' : ''}`}>
                <div className="flex-shrink-0 mt-1">
                  {m.remitente_tipo === 'agente' ? (
                    <img src={agentes.find(a => a.id === m.remitente_id)?.avatar_url} className="w-10 h-10 rounded bg-tj-dark border border-white/10" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-tj-accent/20 border border-tj-accent/40 flex items-center justify-center text-tj-accent font-bold">U</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Operador'}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {new Date(m.creado_en).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed font-light">
                    {m.texto.split(/(@\w+)/g).map((part, i) => (
                      part.startsWith('@') ? <span key={i} className="text-tj-accent font-bold">{part}</span> : part
                    ))}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-gradient-to-t from-tj-dark via-tj-dark/95 to-transparent">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
            {showMentions && (
              <div className="absolute bottom-full left-0 mb-4 w-64 bg-tj-panel border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="p-2 border-b border-white/5 bg-white/5">
                  <span className="text-[9px] uppercase font-bold text-white/40 tracking-widest px-2 italic">Select Agent to Tag</span>
                </div>
                {agentes.map(a => (
                  <button key={a.id} type="button" onClick={() => {
                    const words = inputText.split(' '); words.pop();
                    setInputText([...words, `@${a.nickname}`, ''].join(' '));
                    setShowMentions(false);
                  }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-tj-accent/10 transition-colors group text-left">
                    <img src={a.avatar_url} className="w-6 h-6 rounded" />
                    <span className="text-xs font-medium text-white/70 group-hover:text-tj-accent">@{a.nickname}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="relative group">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  const lastWord = e.target.value.split(' ').pop();
                  setShowMentions(lastWord?.startsWith('@') || false);
                }}
                placeholder="Escribe una instrucción para el sistema..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-5 pl-14 pr-14 text-sm focus:outline-none focus:border-tj-accent/50 focus:bg-white/10 transition-all placeholder:text-white/20"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-tj-accent transition-colors">
                <AtSign size={20} />
              </div>
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-lg bg-tj-accent text-tj-dark flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>

        {/* Modal: Editar Agente */}
        {editingAgente && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-tj-dark/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-tj-panel border border-white/10 rounded-xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold tracking-tight">Configurar Agente</h2>
                <button onClick={() => setEditingAgente(null)} className="text-white/20 hover:text-white"><X size={20} /></button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Nombre Público</label>
                  <input 
                    type="text" 
                    value={editingAgente.nombre} 
                    onChange={e => setEditingAgente({...editingAgente, nombre: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-tj-accent/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Rol del Especialista</label>
                  <input 
                    type="text" 
                    value={editingAgente.rol} 
                    onChange={e => setEditingAgente({...editingAgente, rol: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-tj-accent/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Skills y Conocimientos (Comas)</label>
                  <textarea 
                    value={editingAgente.skills} 
                    onChange={e => setEditingAgente({...editingAgente, skills: e.target.value})}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-tj-accent/50 outline-none resize-none"
                  />
                </div>
                <button 
                  onClick={updateAgente}
                  className="w-full bg-tj-accent text-tj-dark font-bold py-4 rounded-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} /> ACTUALIZAR CONFIGURACIÓN
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

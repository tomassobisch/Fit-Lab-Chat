import React, { useState, useEffect, useRef } from 'react';
import { Send, AtSign, Settings2, Power, Edit3, Check, X, Terminal, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal } from '../types';

// HARDCODED INITIAL DATA TO GUARANTEE RENDERING
const INITIAL_AGENTS: Agente[] = [
  { id: '1', nombre: 'Senior Dev', nickname: 'Programador', rol: 'Ingeniero de Software', skills: 'React, Python, Supabase', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=code', estado_online: true, creado_en: '' },
  { id: '2', nombre: 'Marketing Pro', nickname: 'CommunityManager', rol: 'Marketing', skills: 'Social Media, SEO', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing', estado_online: true, creado_en: '' },
  { id: '3', nombre: 'Legal Expert', nickname: 'Legal', rol: 'Consultoría', skills: 'Contratos, Privacidad', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=legal', estado_online: true, creado_en: '' },
  { id: '4', nombre: 'Data Analyst', nickname: 'Data', rol: 'Análisis', skills: 'SQL, BI', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=data', estado_online: true, creado_en: '' },
  { id: '5', nombre: 'Project Manager', nickname: 'Strategist', rol: 'Estrategia', skills: 'Planning, QA', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=strategy', estado_online: true, creado_en: '' }
];

const INITIAL_MESSAGES: Mensaje[] = [
  { id: 'm1', canal: '#general', remitente_tipo: 'agente', remitente_id: '5', texto: 'Bienvenido a TJOffice. Sistema inicializado y listo para recibir instrucciones.', estado_procesado: true, creado_en: new Date().toISOString() }
];

const AgentCard: React.FC<{ agente: Agente, onEdit: (a: Agente) => void }> = ({ agente, onEdit }) => (
  <div className="bg-tj-graphite/30 border border-white/5 p-4 rounded-lg hover:border-tj-accent/30 transition-all">
    <div className="flex items-start gap-3">
      <div className="relative">
        <img src={agente.avatar_url} className="w-10 h-10 rounded bg-tj-dark border border-white/10" alt="" />
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-tj-panel ${agente.estado_online ? 'bg-tj-accent shadow-[0_0_8px_rgba(204,255,0,0.5)]' : 'bg-white/20'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-xs font-bold text-white truncate">@{agente.nickname}</h3>
        <p className="text-[10px] text-white/40 truncate">{agente.rol}</p>
      </div>
      <button onClick={() => onEdit(agente)} className="text-white/20 hover:text-tj-accent"><Edit3 size={14} /></button>
    </div>
  </div>
);

export const TJOfficeChat: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>(INITIAL_AGENTS);
  const [mensajes, setMensajes] = useState<Mensaje[]>(INITIAL_MESSAGES);
  const [canal, setCanal] = useState<Canal>('#general');
  const [inputText, setInputText] = useState('');
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // FETCH LOGIC (Optional, won't block render)
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: a } = await supabase.from('agentes').select('*');
        if (a && a.length > 0) setAgentes(a);
        const { data: m } = await supabase.from('mensajes_oficina').select('*').eq('canal', canal);
        if (m) setMensajes(prev => m.length > 0 ? m : prev);
      } catch (e) { console.warn("Supabase check failed, using hardcoded data"); }
    };
    fetch();
  }, [canal]);

  return (
    <div className="flex h-screen bg-[#121212] text-white font-sans overflow-hidden">
      {/* Sidebar Izquierda */}
      <aside className="w-72 bg-[#1C1C1C] border-r border-white/5 flex flex-col h-full">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xl font-bold text-white tracking-tighter">
            TJ<span className="text-tj-accent underline decoration-2 underline-offset-4">OFFICE</span>
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-bold px-1">ESPECIALISTAS IA</h2>
          {agentes.map(a => <AgentCard key={a.id} agente={a} onEdit={setEditingAgente} />)}
          <button 
            onClick={() => setIsAutoActive(!isAutoActive)}
            className={`w-full py-4 rounded-lg border flex items-center justify-center gap-3 transition-all ${isAutoActive ? 'bg-tj-accent/10 border-tj-accent text-tj-accent' : 'bg-white/5 border-white/10 text-white/60'}`}
          >
            <Power size={18} />
            <span className="text-xs font-bold uppercase">{isAutoActive ? 'AGENTES ACTIVOS' : 'ACTIVAR AGENTES'}</span>
          </button>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col bg-[#0A0A0A]">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#121212]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-tj-accent animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-widest">Panel de Control de Instrucciones</h2>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
          {mensajes.map(m => (
            <div key={m.id} className={`flex gap-4 max-w-4xl mx-auto ${m.remitente_tipo === 'agente' ? 'bg-white/5 p-4 rounded-lg' : ''}`}>
              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold">
                {m.remitente_tipo === 'agente' ? 'AI' : 'U'}
              </div>
              <div>
                <p className="text-xs font-bold text-white/40 mb-1 uppercase tracking-tighter">{m.remitente_tipo}</p>
                <p className="text-sm text-white/80 leading-relaxed">{m.texto}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8">
          <form className="max-w-4xl mx-auto relative" onSubmit={(e) => { e.preventDefault(); setInputText(''); }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe una instrucción..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-sm focus:outline-none focus:border-tj-accent/50"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-tj-accent text-tj-dark p-2 rounded-lg">
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      {/* Edit Modal Placeholder */}
      {editingAgente && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1C1C1C] border border-white/10 p-8 rounded-xl max-w-md w-full">
            <h2 className="text-lg font-bold mb-4">Editar @{editingAgente.nickname}</h2>
            <p className="text-sm text-white/40 mb-6">Configura las habilidades y el rol de este agente.</p>
            <button onClick={() => setEditingAgente(null)} className="w-full bg-tj-accent text-tj-dark font-bold py-3 rounded-lg">CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
};

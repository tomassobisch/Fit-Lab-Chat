import React, { useState, useEffect, useRef } from 'react';
import { Send, AtSign, Power, Edit3, Terminal, Hash, User, Cpu, Activity, MessageSquare } from 'lucide-react';
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
    const sub = supabase.channel('tj-office').on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_oficina' }, fetchData).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchData = async () => {
    const { data: a } = await supabase.from('agentes').select('*');
    if (a?.length) setAgentes(a);
    const { data: m } = await supabase.from('mensajes_oficina').select('*').order('creado_en', { ascending: true });
    if (m) setMensajes(m);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    await supabase.from('mensajes_oficina').insert([{
      remitente_tipo: 'usuario',
      remitente_id: '00000000-0000-0000-0000-000000000000',
      texto: inputText,
      canal: '#general'
    }]);
    setInputText('');
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden text-[13px]">
      
      {/* COLUMNA 1: AGENTES (Izquierda - 240px) */}
      <aside className="w-[240px] flex-shrink-0 bg-[#0A0A0A] border-r border-white/10 flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-white/10 bg-black">
          <span className="font-black tracking-tighter text-sm">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[9px] font-bold text-white/40 tracking-[0.2em]">AGENTES IA</span>
            <Activity size={10} className="text-[#CCFF00]" />
          </div>
          <div className="space-y-1">
            {agentes.map(a => (
              <div key={a.id} className="group flex items-center gap-3 p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-all">
                <div className="relative">
                  <img src={a.avatar_url} className="w-8 h-8 rounded bg-white/5" alt="" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-black bg-[#CCFF00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[11px] truncate">@{a.nickname}</p>
                  <p className="text-[9px] text-white/40 truncate uppercase">{a.rol}</p>
                </div>
                <button onClick={() => setEditingAgente(a)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-[#CCFF00] transition-all">
                  <Edit3 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-white/10">
          <button 
            onClick={() => setIsAutoActive(!isAutoActive)}
            className={`w-full py-3 rounded text-[10px] font-bold tracking-widest border transition-all ${isAutoActive ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.1)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
          >
            {isAutoActive ? 'AUTÓNOMO: ON' : 'ACTIVAR AGENTES'}
          </button>
        </div>
      </aside>

      {/* COLUMNA 2: ÁREA CENTRAL (Workspace - Flexible) */}
      <section className="flex-1 flex flex-col bg-black relative">
        <header className="h-14 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-white/20" />
            <span className="text-[10px] font-bold tracking-widest text-white/60">WORKSPACE / MAIN_DASHBOARD</span>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto flex flex-col items-center justify-center text-center opacity-20">
          <Terminal size={48} strokeWidth={1} />
          <h2 className="mt-4 text-xl font-light tracking-[0.3em]">MODO_VISUAL_ACTIVO</h2>
          <p className="text-[10px] mt-2 tracking-widest text-white/60">SISTEMA LISTO PARA PROCESAMIENTO MULTI-AGENTE</p>
        </div>
      </section>

      {/* COLUMNA 3: CHAT / INSTRUCCIONES (Derecha - 380px) */}
      <aside className="w-[380px] flex-shrink-0 bg-[#0A0A0A] border-l border-white/10 flex flex-col">
        <header className="h-14 flex items-center px-5 border-b border-white/10 bg-black">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold tracking-widest">INSTRUCCIONES_SISTEMA</span>
          </div>
        </header>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {mensajes.map(m => (
            <div key={m.id} className={`flex gap-3 ${m.remitente_tipo === 'agente' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black' : 'bg-white/10 text-white'}`}>
                {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
              </div>
              <div className={`max-w-[85%] p-3 rounded-lg text-[12px] leading-relaxed ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 text-white/90' : 'bg-[#CCFF00]/5 border border-[#CCFF00]/20 text-white'}`}>
                {m.texto}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-black">
          <form onSubmit={handleSend} className="relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Dar una instrucción..."
              className="w-full bg-[#111] border border-white/10 rounded py-3 pl-4 pr-10 text-[12px] focus:outline-none focus:border-[#CCFF00]/50 transition-all placeholder:text-white/20"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#CCFF00] transition-colors">
              <Send size={16} />
            </button>
          </form>
          <div className="mt-2 flex items-center gap-2 px-1">
            <div className="w-1 h-1 rounded-full bg-[#CCFF00] animate-ping" />
            <span className="text-[8px] text-white/20 font-bold tracking-widest uppercase">Console Sync: Active</span>
          </div>
        </div>
      </aside>

      {/* MODAL CONFIGURACIÓN */}
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded p-6 shadow-2xl">
            <h2 className="text-xs font-bold tracking-[0.2em] mb-6 flex items-center gap-2">
              <Settings2 size={14} className="text-[#CCFF00]" /> CONFIGURAR_AGENTE
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-white/40 font-bold block mb-1">IDENTIFICADOR</label>
                <input type="text" value={editingAgente.nombre} className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs focus:border-[#CCFF00]/40 outline-none" />
              </div>
              <div>
                <label className="text-[9px] text-white/40 font-bold block mb-1">ROL_SISTEMA</label>
                <input type="text" value={editingAgente.rol} className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs focus:border-[#CCFF00]/40 outline-none" />
              </div>
              <button onClick={() => setEditingAgente(null)} className="w-full bg-[#CCFF00] text-black font-black py-3 rounded text-[10px] mt-4 hover:bg-white transition-all">
                GUARDAR CAMBIOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Settings2 = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
);

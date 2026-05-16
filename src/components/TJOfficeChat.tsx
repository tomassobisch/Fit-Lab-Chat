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
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    
    // SUSCRIPCIÓN ROBUSTA
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'tj_mensajes' 
      }, (payload) => {
        console.log('¡Nuevo mensaje recibido por Realtime!', payload.new);
        setMensajes(prev => {
          // Evitar duplicados si el fetch manual y el realtime coinciden
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Mensaje];
        });
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'tj_agentes' 
      }, () => {
        fetchData();
      })
      .subscribe((status) => {
        console.log('Estado de la conexión Realtime:', status);
      });

    return () => { 
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [mensajes]);

  const fetchData = async () => {
    try {
      const { data: a } = await supabase.from('tj_agentes').select('*').order('creado_en', { ascending: true });
      if (a?.length) setAgentes(a);
      
      const { data: m } = await supabase.from('tj_mensajes').select('*').order('creado_en', { ascending: true });
      if (m) setMensajes(m);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
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
      }]).select(); // Usamos .select() para obtener el ID inmediatamente

      if (error) throw error;
      
      // FALLBACK: Si Realtime tarda, lo añadimos manualmente al estado
      if (data && data[0]) {
        setMensajes(prev => {
          if (prev.some(m => m.id === data[0].id)) return prev;
          return [...prev, data[0] as Mensaje];
        });
      }

      setInputText('');
    } catch (error: any) {
      console.error("Error al enviar:", error);
      alert("Error al enviar: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const toggleAutoAgents = async () => {
    const newState = !isAutoActive;
    setIsAutoActive(newState);

    if (newState) {
      // Al activar, enviamos un mensaje de sistema oculto que n8n escuchará
      // para disparar los saludos de todos los agentes
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'usuario',
        remitente_id: '00000000-0000-0000-0000-000000000000',
        texto: '/SYSTEM_ACTIVATE_PROACTIVE_GREETINGS',
        canal: '#general'
      }]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#000000] text-[#FFFFFF] font-sans overflow-hidden text-[12px]">
      
      {/* 1. SIDEBAR IZQUIERDA: AGENTES (Ancho Fijo) */}
      <aside className="w-60 flex-shrink-0 bg-[#0A0A0A] border-r border-white/10 flex flex-col h-full">
        <div className="h-14 flex items-center px-5 border-b border-white/10">
          <span className="font-black tracking-tighter text-sm italic uppercase italic">TJ<span className="text-[#CCFF00]">OFFICE</span></span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[9px] font-bold text-white/40 tracking-[0.2em] uppercase">Especialistas</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isAutoActive ? 'bg-[#CCFF00] animate-pulse shadow-[0_0_8px_#CCFF00]' : 'bg-white/20'}`} />
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
                  <button onClick={() => setEditingAgente(a)} className="text-white/20 hover:text-[#CCFF00] transition-colors">
                    <Edit3 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-black border-t border-white/10">
          <button 
            onClick={toggleAutoAgents}
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

      {/* 2. AREA CENTRAL: CHAT / INSTRUCCIONES (Principal) */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden border-r border-white/10">
        <header className="h-14 flex items-center px-6 border-b border-white/10 bg-black">
          <div className="flex items-center gap-3">
            <MessageSquare size={14} className="text-[#CCFF00]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Control Central de Instrucciones</span>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/5">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <Terminal size={32} />
              <p className="mt-4 text-[10px] tracking-[0.5em] font-bold uppercase">System idle: awaiting commands</p>
            </div>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex gap-4 max-w-2xl mx-auto group animate-in ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 p-4 rounded-lg' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-[9px] font-bold ${m.remitente_tipo === 'agente' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_rgba(204,255,0,0.2)]' : 'bg-white/10 text-white'}`}>
                  {m.remitente_tipo === 'agente' ? 'AI' : 'OP'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-tighter">
                      {m.remitente_tipo === 'agente' ? agentes.find(a => a.id === m.remitente_id)?.nombre : 'Operador Sistema'}
                    </span>
                    <span className="text-[8px] text-white/20">
                      {new Date(m.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-[12px] leading-relaxed ${m.remitente_tipo === 'agente' ? 'text-[#CCFF00]/90 font-medium' : 'text-white/80'}`}>
                    {m.texto}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-black border-t border-white/10">
          <form onSubmit={handleSend} className="max-w-2xl mx-auto relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribir comando de sistema..."
              disabled={isSending}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-14 text-[12px] text-white focus:outline-none focus:border-[#CCFF00]/50 transition-all placeholder:text-white/20"
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
            >
              <Send size={16} />
            </button>
          </form>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-[8px] text-white/20 font-bold tracking-widest uppercase">Connection: Persistent</span>
            <span className="text-[8px] text-[#CCFF00]/40 font-bold tracking-widest uppercase animate-pulse">| Supabase Live</span>
          </div>
        </div>
      </main>

      {/* 3. SIDEBAR DERECHA: MONITOR (320px) */}
      <aside className="w-80 flex-shrink-0 bg-[#0A0A0A] flex flex-col h-full">
        <header className="h-14 flex items-center px-6 border-b border-white/10 bg-black">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-white/20" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Monitorización</span>
          </div>
        </header>
        
        <div className="flex-1 p-6 space-y-6">
          <div className="p-6 border border-white/5 rounded-lg bg-white/[0.01] flex flex-col items-center justify-center gap-4">
            <Terminal size={24} className="text-white/10" />
            <div className="text-center">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/60">Servidores Activos</h3>
              <p className="text-[8px] text-[#CCFF00] uppercase tracking-tighter mt-1">TJ_OFFICE_NODE_01</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-bold text-white/40 uppercase">Red</span>
                <Activity size={10} className="text-[#CCFF00]" />
              </div>
              <div className="h-1 bg-white/5 w-full rounded-full"><div className="bg-[#CCFF00] h-full w-[15%] shadow-[0_0_5px_#CCFF00]" /></div>
            </div>
            <div className="p-4 border border-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-bold text-white/40 uppercase">Procesador</span>
                <Activity size={10} className="text-[#CCFF00]" />
              </div>
              <div className="h-1 bg-white/5 w-full rounded-full"><div className="bg-white/20 h-full w-[8%]" /></div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10">
           <div className="bg-[#CCFF00]/5 border border-[#CCFF00]/20 p-4 rounded text-center">
              <p className="text-[8px] font-black text-[#CCFF00] tracking-widest uppercase">Admin_Access_Only</p>
           </div>
        </div>
      </aside>

      {/* MODAL CONFIGURACIÓN AGENTE */}
      {editingAgente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded p-8 shadow-2xl relative">
            <button onClick={() => setEditingAgente(null)} className="absolute top-4 right-4 text-white/20 hover:text-white">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-8">
              <Settings2 size={16} className="text-[#CCFF00]" />
              <h2 className="text-xs font-bold tracking-[0.2em] uppercase">Configurar Agente</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-2 uppercase">Nombre</label>
                <input 
                  type="text" 
                  value={editingAgente.nombre} 
                  onChange={(e) => setEditingAgente({...editingAgente, nombre: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-xs text-white focus:border-[#CCFF00]/40 outline-none" 
                />
              </div>
              <div>
                <label className="text-[8px] text-white/30 font-bold block mb-2 uppercase">Rol</label>
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
                APLICAR CAMBIOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

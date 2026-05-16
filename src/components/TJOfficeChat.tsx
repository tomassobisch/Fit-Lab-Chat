import React, { useState, useEffect, useRef } from 'react';
import { Send, AtSign, Hash, Circle, LogOut, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Agente, Mensaje, Canal } from '../types';

// --- Sub-component: Sidebar ---
const Sidebar: React.FC<{ 
  agentes: Agente[], 
  currentCanal: Canal, 
  setCanal: (c: Canal) => void 
}> = ({ agentes, currentCanal, setCanal }) => {
  return (
    <div className="w-64 bg-tj-panel border-r border-white/5 flex flex-col h-full">
      <div className="p-6 border-b border-white/5">
        <h1 className="text-xl font-bold text-white tracking-tighter flex items-center gap-2">
          TJ<span className="text-tj-accent underline decoration-2 underline-offset-4">OFFICE</span>
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3 px-3">Canales</h2>
          <div className="space-y-1">
            {(['#general', '#desarrollo', '#marketing'] as Canal[]).map((canal) => (
              <button
                key={canal}
                onClick={() => setCanal(canal)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all ${
                  currentCanal === canal 
                    ? 'bg-white/10 text-tj-accent' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Hash size={16} />
                <span className="text-sm font-medium">{canal.replace('#', '')}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3 px-3">Agentes IA</h2>
          <div className="space-y-1">
            {agentes.map((agente) => (
              <div key={agente.id} className="flex items-center gap-3 px-3 py-2 text-white/60 group cursor-default">
                <div className="relative">
                  <img src={agente.avatar_url} alt={agente.nombre} className="w-8 h-8 rounded bg-tj-graphite border border-white/10" />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-tj-panel ${agente.estado_online ? 'bg-tj-accent shadow-[0_0_8px_rgba(204,255,0,0.5)]' : 'bg-white/20'}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">{agente.nombre}</span>
                  <span className="text-[10px] text-white/40">{agente.rol}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-tj-dark/50 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded bg-tj-accent/20 border border-tj-accent/40 flex items-center justify-center text-tj-accent font-bold text-xs">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">Usuario TJ</p>
            <p className="text-[10px] text-white/40 truncate">Online</p>
          </div>
          <button className="text-white/40 hover:text-white transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Sub-component: Message Item ---
const MessageItem: React.FC<{ mensaje: Mensaje, agentes: Agente[] }> = ({ mensaje, agentes }) => {
  const isAgente = mensaje.remitente_tipo === 'agente';
  const agenteInfo = isAgente ? agentes.find(a => a.id === mensaje.remitente_id) : null;
  const hasMention = mensaje.texto.includes('@');

  return (
    <div className={`group flex gap-4 px-6 py-4 transition-colors hover:bg-white/5 ${
      hasMention ? 'border-l-2 border-tj-accent/50 bg-tj-accent/5' : ''
    }`}>
      <div className="flex-shrink-0 mt-1">
        {isAgente && agenteInfo ? (
          <img src={agenteInfo.avatar_url} alt="Avatar" className="w-10 h-10 rounded bg-tj-graphite border border-white/10" />
        ) : (
          <div className="w-10 h-10 rounded bg-tj-graphite border border-white/10 flex items-center justify-center text-white/40">
            U
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-bold ${isAgente ? 'text-tj-accent' : 'text-white'}`}>
            {isAgente ? agenteInfo?.nombre : 'Usuario TJ'}
          </span>
          {isAgente && (
            <span className="text-[10px] bg-tj-accent/10 text-tj-accent px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
              AI AGENT
            </span>
          )}
          <span className="text-[10px] text-white/30 font-medium">
            {new Date(mensaje.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
          {mensaje.texto.split(/(@\w+)/g).map((part, i) => (
            part.startsWith('@') ? (
              <span key={i} className="text-tj-accent font-semibold px-1 py-0.5 rounded bg-tj-accent/10 cursor-pointer hover:bg-tj-accent/20 transition-colors">
                {part}
              </span>
            ) : part
          ))}
        </p>
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchAgentes = async () => {
    const { data } = await supabase.from('agentes').select('*');
    if (data) setAgentes(data);
  };

  const fetchMensajes = async () => {
    const { data } = await supabase
      .from('mensajes_oficina')
      .select('*')
      .eq('canal', canal)
      .order('creado_en', { ascending: true });
    if (data) setMensajes(data);
  };

  useEffect(() => {
    console.log('TJOfficeChat: Initializing...');

    const init = async () => {
      try {
        console.log('Fetching initial data...');
        const agentsPromise = fetchAgentes();
        const messagesPromise = fetchMensajes();

        // Timeout after 5 seconds to prevent hanging forever
        await Promise.race([
          Promise.all([agentsPromise, messagesPromise]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch Timeout')), 5000))
        ]);

        console.log('Data fetched successfully');
      } catch (err) {
        console.error('Initialization error or timeout:', err);
      }
    };

    init();

    const subscription = supabase
      .channel('tj-office-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_oficina' }, (payload) => {
        setMensajes(prev => [...prev, payload.new as Mensaje]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [canal]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const nuevoMensaje = {
      canal,
      remitente_tipo: 'usuario',
      remitente_id: '00000000-0000-0000-0000-000000000000', // Mock UUID for user
      texto: inputText,
    };

    const { error } = await supabase.from('mensajes_oficina').insert([nuevoMensaje]);
    if (error) console.error('Error sending message:', error);
    setInputText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    
    // Simple @ logic
    const lastWord = val.split(' ').pop();
    if (lastWord?.startsWith('@')) {
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (nickname: string) => {
    const words = inputText.split(' ');
    words.pop(); // Remove the partial @mention
    setInputText([...words, nickname, ''].join(' '));
    setShowMentions(false);
  };

  return (
    <div className="flex h-screen bg-tj-dark text-white font-sans selection:bg-tj-accent selection:text-tj-dark">
      <Sidebar agentes={agentes} currentCanal={canal} setCanal={setCanal} />
      
      <div className="flex-1 flex flex-col min-w-0 bg-[#141414]">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-tj-dark/40 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="text-white/40"><Hash size={20} /></div>
            <h2 className="text-sm font-bold tracking-tight">{canal.replace('#', '')}</h2>
            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            <p className="text-[11px] text-white/40 font-medium hidden sm:block">
              Espacio de trabajo colaborativo multi-agente TJ Fitlab
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white/40 hover:text-white transition-colors">
              <Search size={18} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          <div className="py-8">
            {mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/20 mt-20">
                <div className="w-16 h-16 rounded-full border border-dashed border-white/10 flex items-center justify-center mb-4">
                  <Hash size={32} />
                </div>
                <p className="text-sm font-medium italic">El canal está en silencio. Inicia una conversación.</p>
              </div>
            ) : (
              mensajes.map(m => (
                <MessageItem key={m.id} mensaje={m} agentes={agentes} />
              ))
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-tj-dark to-transparent">
          <form onSubmit={handleSendMessage} className="relative max-w-5xl mx-auto">
            {showMentions && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-tj-panel border border-white/10 rounded-lg shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="p-2 border-b border-white/5 bg-white/5">
                  <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest px-2">Agentes Disponibles</span>
                </div>
                {agentes.map(agente => (
                  <button
                    key={agente.id}
                    type="button"
                    onClick={() => insertMention(agente.nombre)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-tj-accent/10 text-left transition-colors group"
                  >
                    <img src={agente.avatar_url} className="w-6 h-6 rounded bg-tj-graphite" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-tj-accent">{agente.nombre}</span>
                  </button>
                ))}
              </div>
            )}
            
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center text-white/30 group-focus-within:text-tj-accent transition-colors">
                <AtSign size={18} />
              </div>
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder={`Mensaje en ${canal}`}
                className="w-full bg-tj-graphite border border-white/10 rounded-lg pl-12 pr-14 py-4 text-sm focus:outline-none focus:border-tj-accent/50 focus:ring-1 focus:ring-tj-accent/20 transition-all placeholder:text-white/20"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-md bg-tj-accent text-tj-dark hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:scale-100 transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)]"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-4 px-1">
              <span className="text-[10px] text-white/30 font-medium">TIP: Usa <span className="text-white/60">@</span> para mencionar un especialista de IA</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

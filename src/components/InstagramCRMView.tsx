import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  Users, 
  TrendingUp, 
  Eye, 
  Bookmark, 
  Share2, 
  Heart, 
  MessageCircle, 
  RefreshCw, 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Target, 
  DollarSign, 
  Zap, 
  ChevronRight, 
  ArrowUpRight, 
  Calendar, 
  BarChart3, 
  Layers, 
  Key, 
  AlertCircle,
  Award,
  Send
} from 'lucide-react';
import { 
  InstagramAnalyticsData, 
  fetchInstagramMetrics, 
  getInstagramConfig, 
  saveInstagramConfig, 
  testInstagramConnection 
} from '../lib/instagram';
import { supabase } from '../lib/supabase';

export interface InstagramLead {
  id: string;
  nombre: string;
  instagram_user: string;
  telefono?: string;
  estado: 'nuevo' | 'conversacion' | 'agendado' | 'cliente' | 'frio';
  origen: 'Reel' | 'Story' | 'Bio Link' | 'DM Directo' | 'Anuncio Meta';
  interes: string; // ej: "Asesoría Hipertrofia", "TJ App Anual", "Plan Longevidad"
  valor_estimado: number; // en €
  notas: string;
  ultimo_contacto: string;
  creado_en: string;
}

const INITIAL_LEADS: InstagramLead[] = [
  {
    id: 'lead-1',
    nombre: 'Marcos Benítez',
    instagram_user: 'marcos_lift24',
    telefono: '+34 612 345 678',
    estado: 'conversacion',
    origen: 'Reel',
    interes: 'Plan de Hipertrofia & Longevidad',
    valor_estimado: 120,
    notas: 'Comentó en el Reel de "Errores RIR 1-2". Quiere ganar masa muscular sin lesionarse la espalda.',
    ultimo_contacto: new Date(Date.now() - 3600000 * 2).toISOString(),
    creado_en: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'lead-2',
    nombre: 'Elena Domínguez',
    instagram_user: 'elena_crossfit',
    telefono: '+34 689 123 456',
    estado: 'agendado',
    origen: 'Story',
    interes: 'TJ App Anual + HRV Tracking',
    valor_estimado: 240,
    notas: 'Llamada de diagnóstico agendada para el Lunes 18:00 CET. Usa Garmin y quiere sincronización.',
    ultimo_contacto: new Date(Date.now() - 3600000 * 5).toISOString(),
    creado_en: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 'lead-3',
    nombre: 'Carlos Varela',
    instagram_user: 'carlosv_fit',
    telefono: '+34 655 789 012',
    estado: 'cliente',
    origen: 'Bio Link',
    interes: 'Asesoría VIP 1 a 1',
    valor_estimado: 180,
    notas: 'Cliente cerrado. Suscripción activa desde el enlace del carrusel de Ozempic.',
    ultimo_contacto: new Date(Date.now() - 3600000 * 12).toISOString(),
    creado_en: new Date(Date.now() - 3600000 * 72).toISOString()
  },
  {
    id: 'lead-4',
    nombre: 'Sofía Navarro',
    instagram_user: 'sofia_running',
    telefono: '+34 670 998 877',
    estado: 'nuevo',
    origen: 'DM Directo',
    interes: 'Entrenamiento Híbrido & HYROX',
    valor_estimado: 95,
    notas: 'Preguntó por DM sobre preparación para evento HYROX 2026. Pendiente de enviar audio.',
    ultimo_contacto: new Date(Date.now() - 3600000 * 1).toISOString(),
    creado_en: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'lead-5',
    nombre: 'Javier Morales',
    instagram_user: 'javi_power',
    telefono: '+34 633 445 566',
    estado: 'frio',
    origen: 'Reel',
    interes: 'Rutina de Fuerza Máxima',
    valor_estimado: 90,
    notas: 'No respondió al último mensaje hace 5 días. Re-contactar con video de valor.',
    ultimo_contacto: new Date(Date.now() - 3600000 * 120).toISOString(),
    creado_en: new Date(Date.now() - 3600000 * 168).toISOString()
  }
];

interface Props {
  onAskBot: (question: string) => void;
}

export const InstagramCRMView: React.FC<Props> = ({ onAskBot }) => {
  const [data, setData] = useState<InstagramAnalyticsData | null>(null);
  const [leads, setLeads] = useState<InstagramLead[]>(() => {
    const saved = localStorage.getItem('tj_instagram_leads');
    return saved ? JSON.parse(saved) : INITIAL_LEADS;
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'analytics' | 'content'>('pipeline');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Crear Prospecto
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadUser, setNewLeadUser] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadOrigin, setNewLeadOrigin] = useState<'Reel' | 'Story' | 'Bio Link' | 'DM Directo' | 'Anuncio Meta'>('DM Directo');
  const [newLeadInterest, setNewLeadInterest] = useState('Asesoría Integral TJ FITLAB');
  const [newLeadValue, setNewLeadValue] = useState<number>(120);
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // Configuración API
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  useEffect(() => {
    loadMetrics();
    const config = getInstagramConfig();
    setTokenInput(config.accessToken);
    setAccountIdInput(config.accountId);
  }, []);

  useEffect(() => {
    localStorage.setItem('tj_instagram_leads', JSON.stringify(leads));
  }, [leads]);

  const loadMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await fetchInstagramMetrics();
      setData(res);
    } catch (e) {
      console.error("Error al cargar métricas en CRM:", e);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const handleTestAndSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingApi(true);
    setTestStatus(null);
    const result = await testInstagramConnection(tokenInput, accountIdInput);
    setTestStatus(result);
    setIsTestingApi(false);

    if (result.success) {
      saveInstagramConfig(tokenInput, accountIdInput);
      await loadMetrics();
      setTimeout(() => setShowApiConfig(false), 1500);
    }
  };

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadUser.trim()) return;

    const newLead: InstagramLead = {
      id: `lead-${Date.now()}`,
      nombre: newLeadName.trim(),
      instagram_user: newLeadUser.replace('@', '').trim(),
      telefono: newLeadPhone.trim(),
      estado: 'nuevo',
      origen: newLeadOrigin,
      interes: newLeadInterest.trim(),
      valor_estimado: Number(newLeadValue) || 100,
      notas: newLeadNotes.trim() || 'Primer contacto recibido vía Instagram.',
      ultimo_contacto: new Date().toISOString(),
      creado_en: new Date().toISOString()
    };

    setLeads(prev => [newLead, ...prev]);
    setShowAddLeadModal(false);
    setNewLeadName('');
    setNewLeadUser('');
    setNewLeadPhone('');
    setNewLeadNotes('');
  };

  const handleUpdateLeadStatus = (leadId: string, newStatus: InstagramLead['estado']) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, estado: newStatus, ultimo_contacto: new Date().toISOString() } : l));
  };

  const handleDeleteLead = (leadId: string) => {
    if (confirm("¿Seguro que deseas eliminar este prospecto del CRM?")) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
    }
  };

  // Cálculos del Pipeline
  const totalPipelineValue = leads.reduce((acc, l) => l.estado !== 'frio' ? acc + l.valor_estimado : acc, 0);
  const activeClients = leads.filter(l => l.estado === 'cliente').length;
  const inNegotiation = leads.filter(l => l.estado === 'conversacion' || l.estado === 'agendado').length;
  const conversionRate = leads.length > 0 ? Number(((activeClients / leads.length) * 100).toFixed(1)) : 0;

  const filteredLeads = leads.filter(l => {
    const matchesStatus = statusFilter === 'todos' || l.estado === statusFilter;
    const matchesSearch = l.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.instagram_user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.interes.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const ov = data?.overview;

  return (
    <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 scrollbar-hide bg-[#050505] text-white">
      
      {/* CABECERA PRINCIPAL DEL CRM */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center shadow-lg shadow-pink-500/20 border border-white/20">
            <Instagram size={24} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-white">
                Instagram <span className="text-[#CCFF00]">CRM & Growth Hub</span>
              </h1>
              <a 
                href="https://www.instagram.com/tsteam.fit/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 hover:text-white transition-all flex items-center gap-1"
                title="Abrir perfil oficial @tsteam.fit"
              >
                <span>@tsteam.fit</span>
                <ExternalLink size={9} />
              </a>
              <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest ${data?.isConnectedRealApi ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                {data?.isConnectedRealApi ? '● Meta API 100% Conectada' : '○ Modo @tsteam.fit'}
              </span>
            </div>
            <p className="text-[10px] text-white/50 font-mono mt-0.5">
              Gestión de prospectos de DMs, embudos de conversión y analítica integral 360° con @InstaAnalyst
            </p>
          </div>
        </div>

        {/* ACCIONES DE CABECERA */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => onAskBot("@InstaAnalyst Realiza una AUDITORÍA INTEGRAL 360° de la cuenta @tsteam.fit (https://www.instagram.com/tsteam.fit/): analiza salud de seguidores, ratio de engagement, rendimiento de los últimos Reels/Posts, retención en los primeros 3 segundos, conversión de DMs a clientes agendados y entrega un plan de acción estratégico de 7 días con 3 ganchos virales.")}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-90 text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(221,42,123,0.3)] border border-pink-400/30"
          >
            <Sparkles size={13} className="text-[#CCFF00]" />
            <span>Auditar @tsteam.fit con IA</span>
          </button>

          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${showApiConfig ? 'bg-[#CCFF00] text-black border-[#CCFF00]' : 'bg-white/5 text-white/80 border-white/10 hover:text-white hover:bg-white/10'}`}
          >
            <Key size={13} />
            <span>Configurar Token API</span>
          </button>

          <button
            onClick={() => setShowAddLeadModal(true)}
            className="px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-white text-black font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_#CCFF0033]"
          >
            <Plus size={14} />
            <span>Nuevo Prospecto</span>
          </button>

          <button
            onClick={loadMetrics}
            disabled={isLoadingMetrics}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-[#CCFF00] hover:border-[#CCFF00]/40 transition-all disabled:opacity-40"
            title="Sincronizar métricas en tiempo real"
          >
            <RefreshCw size={15} className={isLoadingMetrics ? 'animate-spin text-[#CCFF00]' : ''} />
          </button>
        </div>
      </div>

      {/* PANEL DESPLEGABLE: CONFIGURACIÓN META GRAPH API */}
      {showApiConfig && (
        <div className="max-w-7xl mx-auto p-5 rounded-2xl bg-black/90 border border-indigo-500/40 shadow-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Key size={15} />
              <span>Conexión Directa con Instagram Graph API (Meta Developers)</span>
            </div>
            <a 
              href="https://developers.facebook.com/tools/explorer/" 
              target="_blank" 
              rel="noreferrer"
              className="text-[9px] text-[#CCFF00] hover:underline flex items-center gap-1 font-mono"
            >
              Abrir Meta Graph Explorer <ExternalLink size={10} />
            </a>
          </div>

          <form onSubmit={handleTestAndSaveApi} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">
                Meta User / Page Access Token
              </label>
              <input 
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="EAABw..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 font-mono outline-none"
              />
              <span className="text-[8px] text-white/30 mt-1 block">Permisos recomendados: instagram_basic, instagram_manage_insights</span>
            </div>

            <div>
              <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">
                Instagram Business Account ID
              </label>
              <input 
                type="text"
                value={accountIdInput}
                onChange={(e) => setAccountIdInput(e.target.value)}
                placeholder="Ej: 17841405309211111"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 font-mono outline-none"
              />
              <span className="text-[8px] text-white/30 mt-1 block">Tu ID de Instagram Business vinculado a tu Fan Page</span>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              {testStatus && (
                <div className={`flex items-center gap-2 text-[10px] font-mono ${testStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                  {testStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{testStatus.message}</span>
                </div>
              )}
              {!testStatus && <div className="text-[9px] text-white/40 font-mono">Guarda tus credenciales para conectar las estadísticas 100% en vivo.</div>}

              <button
                type="submit"
                disabled={isTestingApi}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                <Zap size={13} />
                <span>{isTestingApi ? 'Verificando con Meta...' : 'Probar & Guardar Conexión'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* METRICAS SUMMARY BAR (TOP CRM & SOCIAL KPIs) */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        
        {/* Total Seguidores */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-pink-500/30 transition-all">
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Seguidores</span>
            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
              <Users size={14} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-white font-mono">{ov?.followersCount.toLocaleString() || '14,820'}</div>
          <div className="text-[9px] text-green-400 mt-1 flex items-center gap-1 font-mono">
            <span>+480</span>
            <span className="text-white/40">este mes (+3.4%)</span>
          </div>
        </div>

        {/* Engagement Rate */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-[#CCFF00]/30 transition-all">
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Engagement Rate</span>
            <div className="p-1.5 rounded-lg bg-[#CCFF00]/10 text-[#CCFF00]">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#CCFF00] font-mono">{ov?.engagementRate || 4.92}%</div>
          <div className="text-[9px] text-[#CCFF00]/80 mt-1 flex items-center gap-1 font-mono">
            <span>2.5x</span>
            <span className="text-white/40">sobre media fitness</span>
          </div>
        </div>

        {/* Alcance Mensual */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Alcance (Reach 28d)</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Eye size={14} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-white font-mono">{ov?.weeklyReach.toLocaleString() || '68,450'}</div>
          <div className="text-[9px] text-indigo-300 mt-1 font-mono">
            <span>{ov?.weeklyImpressions.toLocaleString() || '112,300'} impresiones</span>
          </div>
        </div>

        {/* Valor Pipeline CRM */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Pipeline CRM</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono">€{totalPipelineValue.toLocaleString()}</div>
          <div className="text-[9px] text-white/40 mt-1 font-mono">
            <span>{leads.length} prospectos en curso</span>
          </div>
        </div>

        {/* Tasa Conversión DM a Cliente */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-all col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Tasa de Cierre</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Target size={14} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-300 font-mono">{conversionRate}%</div>
          <div className="text-[9px] text-white/40 mt-1 font-mono">
            <span>{activeClients} socios convertidos</span>
          </div>
        </div>

      </div>

      {/* PESTAÑAS DE VISTA: PIPELINE CRM vs ESTADÍSTICAS PROFUNDAS vs RENDIMIENTO CONTENIDO */}
      <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'pipeline' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0033]' : 'text-white/60 hover:text-white'}`}
          >
            <Layers size={13} />
            <span>Pipeline de Leads ({leads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0033]' : 'text-white/60 hover:text-white'}`}
          >
            <BarChart3 size={13} />
            <span>Estadísticas & Audiencia</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'content' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0033]' : 'text-white/60 hover:text-white'}`}
          >
            <Sparkles size={13} />
            <span>Top Reels & Posts</span>
          </button>
        </div>

        {/* ACCIÓN ASISTENTE IA INSTAGRAM */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => onAskBot("@InstaAnalyst Realiza un diagnóstico del embudo de ventas en Instagram: analiza la tasa de conversión de nuestros DMs y recomiéndame un guión de 3 pasos para cerrar leads indecisos.")}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600/30 to-purple-600/30 border border-pink-500/40 text-pink-200 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(221,42,123,0.15)]"
          >
            <Sparkles size={12} className="text-pink-400" />
            <span>Auditoría de Conversión IA</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* VISTA 1: PIPELINE CRM DE PROSPECTOS */}
      {/* ============================================================ */}
      {activeTab === 'pipeline' && (
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* FILTROS & BUSCADOR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2 flex-grow max-w-md bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Search size={14} className="text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, usuario de Instagram (@) o interés..."
                className="bg-transparent text-xs text-white placeholder-white/40 outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {['todos', 'nuevo', 'conversacion', 'agendado', 'cliente', 'frio'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-[8.5px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${statusFilter === st ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/40 hover:text-white'}`}
                >
                  {st === 'todos' ? 'Todos' : st === 'conversacion' ? 'En Chat' : st}
                </button>
              ))}
            </div>
          </div>

          {/* TABLA / TARJETAS DE PROSPECTOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => {
              const statusColors = {
                nuevo: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                conversacion: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                agendado: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                cliente: 'bg-green-500/20 text-green-300 border-green-500/30',
                frio: 'bg-white/10 text-white/40 border-white/10'
              };

              return (
                <div 
                  key={lead.id} 
                  className="p-5 rounded-2xl bg-[#090909] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-4 relative group shadow-xl"
                >
                  {/* Encabezado del Prospecto */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">{lead.nombre}</h3>
                        <a 
                          href={`https://instagram.com/${lead.instagram_user}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] text-pink-400 hover:underline flex items-center gap-1 font-mono mt-0.5"
                        >
                          @{lead.instagram_user} <ExternalLink size={10} />
                        </a>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${statusColors[lead.estado]}`}>
                        {lead.estado}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[10px] font-mono text-white/70 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-white/40">Interés:</span>
                        <span className="text-white font-bold">{lead.interes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Origen:</span>
                        <span className="text-[#CCFF00]">{lead.origen}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Valor Est.:</span>
                        <span className="text-emerald-400 font-bold">€{lead.valor_estimado}/mes</span>
                      </div>
                    </div>

                    {lead.notas && (
                      <p className="text-[10px] text-white/60 leading-relaxed mt-2.5 italic bg-black/40 p-2.5 rounded-lg border border-white/5">
                        "{lead.notas}"
                      </p>
                    )}
                  </div>

                  {/* Acciones del Prospecto */}
                  <div className="space-y-2.5 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={lead.estado}
                        onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as any)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-white uppercase tracking-wider outline-none focus:border-[#CCFF00]/40 cursor-pointer"
                      >
                        <option value="nuevo" className="bg-[#0A0A0A]">📥 Nuevo DM</option>
                        <option value="conversacion" className="bg-[#0A0A0A]">💬 En Conversación</option>
                        <option value="agendado" className="bg-[#0A0A0A]">📅 Agendado / Demo</option>
                        <option value="cliente" className="bg-[#0A0A0A]">🏆 Cliente Activo</option>
                        <option value="frio" className="bg-[#0A0A0A]">❄️ En Espera / Frío</option>
                      </select>

                      <div className="flex items-center gap-1.5">
                        {lead.telefono && (
                          <a
                            href={`https://wa.me/${lead.telefono.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                            title="Chatear por WhatsApp"
                          >
                            <Phone size={12} />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            onAskBot(`@InstaAnalyst Recomiéndame un mensaje persuasivo personalizado para contactar por Instagram a @${lead.instagram_user} (${lead.nombre}), quien está interesado en "${lead.interes}" y provino de "${lead.origen}".`);
                          }}
                          className="p-2 rounded-lg bg-pink-500/10 text-pink-400 hover:bg-pink-500 hover:text-white transition-all"
                          title="Generar Copy Personalizado con IA"
                        >
                          <Sparkles size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="text-[9px] text-red-500/60 hover:text-red-400 p-1 font-mono"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLeads.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <Users size={32} className="mx-auto text-white/20" />
              <p className="text-sm font-bold text-white/60">No se encontraron prospectos con los filtros actuales.</p>
              <button
                onClick={() => setShowAddLeadModal(true)}
                className="px-4 py-2 rounded-xl bg-[#CCFF00] text-black font-black text-[9px] uppercase tracking-wider"
              >
                + Añadir Nuevo Prospecto
              </button>
            </div>
          )}

        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA 2: ESTADÍSTICAS PROFUNDAS & AUDIENCIA */}
      {/* ============================================================ */}
      {activeTab === 'analytics' && (
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* PERFIL OFICIAL & DETALLES */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <img 
                src={ov?.profilePictureUrl || '/logo-tjo.jpg'} 
                alt="" 
                className="w-16 h-16 rounded-2xl bg-black border-2 border-[#CCFF00] object-cover shadow-[0_0_25px_rgba(204,255,0,0.3)]"
              />
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-white">@{ov?.username || 'tsteam.fit'}</h2>
                  <a 
                    href="https://www.instagram.com/tsteam.fit/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:text-white text-[9px] font-black font-mono flex items-center gap-1"
                  >
                    <span>OFICIAL @tsteam.fit</span>
                    <ExternalLink size={9} />
                  </a>
                </div>
                <p className="text-xs text-white/70 font-medium mt-0.5">{ov?.name || 'TS TEAM FIT | Entrenamiento & Rendimiento'}</p>
                <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono mt-1.5">
                  <span>👥 {ov?.followersCount.toLocaleString()} Seguidores</span>
                  <span>•</span>
                  <span>🔄 {ov?.followsCount} Siguiendo</span>
                  <span>•</span>
                  <span>📸 {ov?.mediaCount} Publicaciones</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => onAskBot("@InstaAnalyst Realiza un análisis profundo de la audiencia de @tsteam.fit: qué porcentaje representa el grupo de 25-34 años, qué contenido de entrenamiento de hipertrofia y fuerza retiene mejor y cómo optimizar la biografía y enlace para captar más clientes.")}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Target size={13} className="text-[#CCFF00]" />
                <span>Auditar Audiencia @tsteam.fit</span>
              </button>
              <button
                onClick={() => onAskBot("@InstaAnalyst ¿Cuáles son los mejores horarios y días de la semana para publicar Reels de fuerza y rendimiento en la cuenta @tsteam.fit para maximizar el ratio de guardados y compartidos en España?")}
                className="px-4 py-2 rounded-xl bg-[#CCFF00] text-black font-black text-[9px] uppercase tracking-wider hover:bg-white transition-all shadow-[0_0_12px_#CCFF0033] flex items-center gap-1.5"
              >
                <Clock size={13} />
                <span>Horarios @tsteam.fit</span>
              </button>
            </div>
          </div>

          {/* GRID DE MÉTRICAS AVANZADAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Demografía y Edad */}
            <div className="p-5 rounded-2xl bg-[#090909] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Users size={14} className="text-pink-400" />
                  Demografía Principal
                </h3>
                <span className="text-[8px] font-mono text-white/40">Meta Insights</span>
              </div>
              <div className="space-y-3 font-mono text-[10px]">
                <div>
                  <div className="flex justify-between text-white/60 mb-1">
                    <span>25 - 34 años (Público Objetivo)</span>
                    <span className="text-white font-bold">54%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-[#CCFF00] w-[54%] rounded-full"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-white/60 mb-1">
                    <span>35 - 44 años (Longevidad & Salud)</span>
                    <span className="text-white font-bold">28%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[28%] rounded-full"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-white/60 mb-1">
                    <span>18 - 24 años (Gen Z / TikTok crossover)</span>
                    <span className="text-white font-bold">18%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-[18%] rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ciudades y Geografía */}
            <div className="p-5 rounded-2xl bg-[#090909] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Target size={14} className="text-[#CCFF00]" />
                  Ubicaciones Top
                </h3>
                <span className="text-[8px] font-mono text-white/40">Geolocalización</span>
              </div>
              <div className="space-y-2.5 text-[10px] font-mono">
                <div className="flex justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/80">1. Madrid, España</span>
                  <span className="text-[#CCFF00] font-bold">34.2%</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/80">2. Barcelona, España</span>
                  <span className="text-white font-bold">22.8%</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/80">3. Valencia / Sevilla</span>
                  <span className="text-white font-bold">16.4%</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/80">4. LATAM (CDMX, Bogotá)</span>
                  <span className="text-indigo-400 font-bold">14.6%</span>
                </div>
              </div>
            </div>

            {/* Horarios Pico de Conversión */}
            <div className="p-5 rounded-2xl bg-[#090909] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Clock size={14} className="text-cyan-400" />
                  Pico de Interacción
                </h3>
                <span className="text-[8px] font-mono text-white/40">CET Time</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                  <div className="text-base font-black font-mono">19:30 - 21:00 CET</div>
                  <div className="text-[9px] text-white/60 mt-0.5">Ventana de mayor retención de Reels y apertura de DMs</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] font-mono text-white/70 space-y-1">
                  <p>• Días más fuertes: <strong>Martes & Jueves</strong></p>
                  <p>• Stories de conversión: <strong>Domingo 20:00</strong></p>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA 3: TOP REELS & PUBLICACIONES ANALIZADAS */}
      {/* ============================================================ */}
      {activeTab === 'content' && (
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Rendimiento por Publicación & Reel</h3>
              <p className="text-[10px] text-white/40 font-mono">Métricas de Engagement, Guardados (Saves) y Compartidos (Shares)</p>
            </div>
            <button
              onClick={() => onAskBot("@InstaAnalyst Desglosa los 3 formatos de Reels con mayor ratio de retención y guardados para TJ FITLAB y escribe el guión de 1 Reel viral para esta semana.")}
              className="px-3.5 py-2 rounded-xl bg-[#CCFF00] text-black font-black text-[9px] uppercase tracking-wider hover:bg-white transition-all shadow-[0_0_10px_#CCFF0033]"
            >
              + Guión Viral con IA
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.recentMedia.map((m) => (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-[#090909] border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row gap-4 group shadow-xl"
              >
                <div className="w-full sm:w-28 h-36 sm:h-auto rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-white/10">
                  <img
                    src={m.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/80 text-[8px] font-black text-[#CCFF00] uppercase font-mono">
                    {m.mediaType === 'VIDEO' ? 'REEL' : m.mediaType === 'CAROUSEL_ALBUM' ? 'CARRUSEL' : 'POST'}
                  </span>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[9px] font-bold text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded font-mono">
                        ER: {m.engagementRate}%
                      </span>
                      <span className="text-[8px] text-white/40 font-mono">
                        {new Date(m.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/90 line-clamp-3 leading-relaxed font-sans">
                      {m.caption}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/10 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 text-white/70">
                      <Heart size={12} className="text-red-400" />
                      <span>{m.likeCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/70">
                      <MessageCircle size={12} className="text-blue-400" />
                      <span>{m.commentsCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white font-bold">
                      <Bookmark size={12} className="text-[#CCFF00]" />
                      <span>{m.savedCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white font-bold">
                      <Share2 size={12} className="text-pink-400" />
                      <span>{m.sharesCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO PROSPECTO */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowAddLeadModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#CCFF00] flex items-center justify-center text-black">
                <Plus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Registrar Prospecto CRM</h3>
                <p className="text-[9px] text-white/40 font-mono">Añade un lead captado por DM, Reel o Story</p>
              </div>
            </div>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    placeholder="Ej: Laura Martínez"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Usuario Instagram (@)</label>
                  <input
                    type="text"
                    value={newLeadUser}
                    onChange={(e) => setNewLeadUser(e.target.value)}
                    placeholder="laura_fit"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Teléfono / WhatsApp (Opcional)</label>
                  <input
                    type="text"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Origen del Lead</label>
                  <select
                    value={newLeadOrigin}
                    onChange={(e) => setNewLeadOrigin(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 cursor-pointer"
                  >
                    <option value="DM Directo" className="bg-[#0A0A0A]">📥 Mensaje Directo (DM)</option>
                    <option value="Reel" className="bg-[#0A0A0A]">🎬 Comentario en Reel</option>
                    <option value="Story" className="bg-[#0A0A0A]">📱 Respuesta a Story</option>
                    <option value="Bio Link" className="bg-[#0A0A0A]">🔗 Clic en Enlace de Bio</option>
                    <option value="Anuncio Meta" className="bg-[#0A0A0A]">🎯 Anuncio Meta Ads</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Programa de Interés</label>
                  <input
                    type="text"
                    value={newLeadInterest}
                    onChange={(e) => setNewLeadInterest(e.target.value)}
                    placeholder="Ej: Asesoría Hipertrofia, TJ App..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Valor Estimado (€/mes)</label>
                  <input
                    type="number"
                    value={newLeadValue}
                    onChange={(e) => setNewLeadValue(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Notas / Diagnóstico Inicial</label>
                <textarea
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  placeholder="Detalles sobre sus metas físicas, dudas sobre precios..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#CCFF00] hover:bg-white text-black font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_#CCFF0033]"
              >
                Guardar Prospecto en CRM
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

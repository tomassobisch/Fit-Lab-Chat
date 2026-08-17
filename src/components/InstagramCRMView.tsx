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
  Send,
  Edit3,
  Play,
  Flame,
  FileText,
  Check,
  Film,
  Copy,
  Video,
  Scissors,
  Volume2,
  Rocket,
  Sliders,
  Maximize2,
  UserMinus,
  UserX,
  ShieldAlert,
  Trash2,
  HelpCircle,
  CheckSquare,
  Square,
  UserPlus,
  UploadCloud,
  FileCode,
  FolderArchive,
  Download
} from 'lucide-react';
import { 
  InstagramAnalyticsData, 
  InstagramMediaItem,
  fetchInstagramMetrics, 
  getInstagramConfig, 
  saveInstagramConfig, 
  testInstagramConnection,
  saveCustomInstagramOverview,
  getCustomInstagramOverview,
  fetchInstagramInteractedUsers
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

export interface NonFollowerAccount {
  id: string;
  username: string;
  nombre: string;
  avatarUrl: string;
  tipo: 'no_sigue' | 'inactivo' | 'marca_bot';
  seguidoDesde: string;
  interaccion: string;
  unfollowed: boolean;
}

const INITIAL_NON_FOLLOWERS: NonFollowerAccount[] = [
  {
    id: 'nf-1',
    username: 'gym_supplements_brand_eu',
    nombre: 'Euro Supps Distribution',
    avatarUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=60',
    tipo: 'marca_bot',
    seguidoDesde: 'Hace 6 meses',
    interaccion: '0 interacciones (Cuenta comercial)',
    unfollowed: false
  },
  {
    id: 'nf-2',
    username: 'runner_pro_madrid',
    nombre: 'Marcos Trail & Run',
    avatarUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=60',
    tipo: 'no_sigue',
    seguidoDesde: 'Hace 4 meses',
    interaccion: 'No te sigue de vuelta',
    unfollowed: false
  },
  {
    id: 'nf-3',
    username: 'fitness_motivation_clips99',
    nombre: 'Daily Motivation Reels',
    avatarUrl: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=150&auto=format&fit=crop&q=60',
    tipo: 'marca_bot',
    seguidoDesde: 'Hace 8 meses',
    interaccion: 'Cuenta spam / repost',
    unfollowed: false
  },
  {
    id: 'nf-4',
    username: 'lucas_cross_lifestyle',
    nombre: 'Lucas Hernández',
    avatarUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&auto=format&fit=crop&q=60',
    tipo: 'inactivo',
    seguidoDesde: 'Hace 1 año',
    interaccion: 'Sin publicaciones hace +180 días',
    unfollowed: false
  },
  {
    id: 'nf-5',
    username: 'powerlifting_apparel_gear',
    nombre: 'Strength Apparel Co',
    avatarUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=60',
    tipo: 'no_sigue',
    seguidoDesde: 'Hace 3 meses',
    interaccion: 'No te sigue de vuelta',
    unfollowed: false
  },
  {
    id: 'nf-6',
    username: 'coach_matias_training',
    nombre: 'Matías R.',
    avatarUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=60',
    tipo: 'no_sigue',
    seguidoDesde: 'Hace 5 meses',
    interaccion: 'Dejó de seguirte recientemente',
    unfollowed: false
  }
];

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
  const [activeTab, setActiveTab] = useState<'pipeline' | 'analytics' | 'content' | 'scripts' | 'unfollowers'>('content');
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

  // Modal Ajustar Métricas Reales
  const [showEditMetricsModal, setShowEditMetricsModal] = useState(false);
  const [editFollowers, setEditFollowers] = useState<number>(14820);
  const [editMediaCount, setEditMediaCount] = useState<number>(142);
  const [editEngagementRate, setEditEngagementRate] = useState<number>(4.92);
  const [editMonthlyReach, setEditMonthlyReach] = useState<number>(68450);
  const [editWeeklyImpressions, setEditWeeklyImpressions] = useState<number>(112300);
  const [editBio, setEditBio] = useState<string>('⚡ Ciencia aplicada al entrenamiento de fuerza, hipertrofia y composición corporal.\n🏋️‍♂️ Asesorías Personalizadas & Alto Rendimiento.');

  // Modal Ficha de Rendimiento de Publicación
  const [selectedMediaForDetails, setSelectedMediaForDetails] = useState<InstagramMediaItem | null>(null);

  // Modal Vista Previa de Video / Reel Player Simulator
  const [previewVideoModal, setPreviewVideoModal] = useState<InstagramMediaItem | null>(null);

  // Estado del Estudio de Guiones & Plantillas
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [selectedScriptCategory, setSelectedScriptCategory] = useState<'todos' | 'viral' | 'ciencia' | 'habitos' | 'coaches'>('todos');

  // Estado del Módulo Unfollow Hub (No Seguidores)
  const [nonFollowers, setNonFollowers] = useState<NonFollowerAccount[]>(() => {
    const saved = localStorage.getItem('tj_instagram_non_followers');
    return saved ? JSON.parse(saved) : INITIAL_NON_FOLLOWERS;
  });
  const [unfollowFilter, setUnfollowFilter] = useState<'todos' | 'no_sigue' | 'inactivo' | 'marca_bot' | 'unfollowed'>('todos');
  const [unfollowSearch, setUnfollowSearch] = useState('');
  const [unfollowedCountToday, setUnfollowedCountToday] = useState<number>(() => {
    const saved = localStorage.getItem('tj_unfollowed_count_today');
    return saved ? Number(saved) : 0;
  });
  const [showImportAccountsModal, setShowImportAccountsModal] = useState(false);
  const [importAccountsText, setImportAccountsText] = useState('');
  const [jsonImportTab, setJsonImportTab] = useState<'upload' | 'api_scan' | 'text'>('upload');
  const [isScanningApiUsers, setIsScanningApiUsers] = useState(false);
  const [followingJsonData, setFollowingJsonData] = useState<{ username: string; timestamp?: number }[] | null>(null);
  const [followersJsonData, setFollowersJsonData] = useState<{ username: string; timestamp?: number }[] | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  const handleToggleUnfollow = (id: string) => {
    setNonFollowers(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const nextState = !item.unfollowed;
          if (nextState) {
            setUnfollowedCountToday(c => {
              const nextCount = c + 1;
              localStorage.setItem('tj_unfollowed_count_today', String(nextCount));
              return nextCount;
            });
          }
          return { ...item, unfollowed: nextState };
        }
        return item;
      });
      localStorage.setItem('tj_instagram_non_followers', JSON.stringify(updated));
      return updated;
    });
  };

  // Procesar archivo JSON oficial descargado de Instagram
  const handleProcessFile = async (e: React.ChangeEvent<HTMLInputElement>, target: 'following' | 'followers') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      let items: { username: string; timestamp?: number }[] = [];

      // Estructura 1: following.json -> { relationships_following: [ { string_list_data: [ { value: '...', timestamp: ... } ] } ] }
      if (json.relationships_following && Array.isArray(json.relationships_following)) {
        items = json.relationships_following.map((entry: any) => {
          const d = entry.string_list_data?.[0];
          return { username: d?.value || entry.title || '', timestamp: d?.timestamp };
        }).filter((i: any) => i.username);
      } 
      // Estructura 2: followers_1.json -> [ { string_list_data: [ { value: '...', timestamp: ... } ] } ]
      else if (Array.isArray(json)) {
        items = json.map((entry: any) => {
          const d = entry.string_list_data?.[0];
          return { username: d?.value || entry.title || (typeof entry === 'string' ? entry : ''), timestamp: d?.timestamp };
        }).filter((i: any) => i.username);
      }
      // Estructura 3: { relationships_followers: [ ... ] }
      else if (json.relationships_followers && Array.isArray(json.relationships_followers)) {
        items = json.relationships_followers.map((entry: any) => {
          const d = entry.string_list_data?.[0];
          return { username: d?.value || entry.title || '', timestamp: d?.timestamp };
        }).filter((i: any) => i.username);
      }

      if (target === 'following') {
        setFollowingJsonData(items);
        setUploadStatusMsg(`✓ Cargadas ${items.length} cuentas seguidas (following.json)`);
      } else {
        setFollowersJsonData(items);
        setUploadStatusMsg(`✓ Cargados ${items.length} seguidores reales (followers_1.json)`);
      }
    } catch (err) {
      console.error("Error leyendo JSON de Instagram:", err);
      setUploadStatusMsg("❌ Error al leer el archivo. Asegúrate de subir el archivo .json oficial de Instagram.");
    }
  };

  // Comparar Following vs Followers para generar la lista real 100% precisa
  const handleCompareAndApplyJson = () => {
    if (!followingJsonData) return;
    const followersSet = new Set((followersJsonData || []).map(f => f.username.toLowerCase()));

    const notFollowingBack = followingJsonData.filter(f => !followersSet.has(f.username.toLowerCase()));

    const newAccounts: NonFollowerAccount[] = notFollowingBack.map((item, idx) => ({
      id: `real-nf-${Date.now()}-${idx}`,
      username: item.username,
      nombre: item.username,
      avatarUrl: `https://images.unsplash.com/photo-1534438327276?w=150&auto=format&fit=crop&q=60`,
      tipo: 'no_sigue',
      seguidoDesde: item.timestamp ? new Date(item.timestamp * 1000).toLocaleDateString() : 'Datos reales de Instagram',
      interaccion: 'Cuenta real que no te sigue de vuelta',
      unfollowed: false
    }));

    setNonFollowers(newAccounts);
    localStorage.setItem('tj_instagram_non_followers', JSON.stringify(newAccounts));
    setShowImportAccountsModal(false);
    setUploadStatusMsg(null);
  };

  // Escanear usuarios reales que comentan en los Reels mediante Meta Graph API
  const handleScanMetaApiComments = async () => {
    setIsScanningApiUsers(true);
    try {
      const realUsers = await fetchInstagramInteractedUsers();
      if (realUsers.length > 0) {
        const uniqueUsers = Array.from(new Set(realUsers.map(u => u.username)));
        const newItems: NonFollowerAccount[] = uniqueUsers.map((un, idx) => {
          const match = realUsers.find(r => r.username === un);
          return {
            id: `meta-api-${Date.now()}-${idx}`,
            username: un,
            nombre: un,
            avatarUrl: 'https://images.unsplash.com/photo-1534438327276?w=150&auto=format&fit=crop&q=60',
            tipo: 'no_sigue',
            seguidoDesde: match?.timestamp ? new Date(match.timestamp).toLocaleDateString() : 'Detectado en Meta API',
            interaccion: match?.text ? `Comentó: "${match.text.slice(0, 40)}..."` : 'Interactuó en Reels',
            unfollowed: false
          };
        });

        setNonFollowers(prev => {
          const updated = [...newItems, ...prev.filter(p => !uniqueUsers.includes(p.username))];
          localStorage.setItem('tj_instagram_non_followers', JSON.stringify(updated));
          return updated;
        });
        setUploadStatusMsg(`✓ Se detectaron ${uniqueUsers.length} usuarios reales que interactúan con tus Reels.`);
      } else {
        setUploadStatusMsg(`ℹ️ Conexión con Meta API activa. No se encontraron nuevos comentarios en los últimos 6 Reels analizados.`);
      }
    } catch (err) {
      console.error("Error escaneando comentarios de Meta API:", err);
    } finally {
      setIsScanningApiUsers(false);
    }
  };

  const handleImportCustomNonFollowers = (e: React.FormEvent) => {
    e.preventDefault();
    const usernames = importAccountsText.split(/[\n, ]+/).map(u => u.replace('@', '').trim()).filter(Boolean);
    const newItems: NonFollowerAccount[] = usernames.map((un, idx) => ({
      id: `import-${Date.now()}-${idx}`,
      username: un,
      nombre: un,
      avatarUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=60',
      tipo: 'no_sigue',
      seguidoDesde: 'Detectado en auditoría',
      interaccion: 'No te sigue de vuelta',
      unfollowed: false
    }));
    setNonFollowers(prev => {
      const updated = [...newItems, ...prev];
      localStorage.setItem('tj_instagram_non_followers', JSON.stringify(updated));
      return updated;
    });
    setImportAccountsText('');
    setShowImportAccountsModal(false);
  };

  useEffect(() => {
    loadMetrics();
    const config = getInstagramConfig();
    setTokenInput(config.accessToken);
    setAccountIdInput(config.accountId);

    const custom = getCustomInstagramOverview();
    setEditFollowers(custom.followersCount || 14820);
    setEditMediaCount(custom.mediaCount || 142);
    setEditEngagementRate(custom.engagementRate || 4.92);
    setEditMonthlyReach(custom.weeklyReach || 68450);
    setEditWeeklyImpressions(custom.weeklyImpressions || 112300);
    setEditBio(custom.biography || '');
  }, []);

  const handleSaveCustomMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomInstagramOverview({
      followersCount: editFollowers,
      mediaCount: editMediaCount,
      engagementRate: editEngagementRate,
      weeklyReach: editMonthlyReach,
      weeklyImpressions: editWeeklyImpressions,
      biography: editBio
    });
    loadMetrics();
    setShowEditMetricsModal(false);
  };

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
            onClick={() => setShowEditMetricsModal(true)}
            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-white/5 text-white/80 border border-white/10 hover:text-[#CCFF00] hover:border-[#CCFF00]/40"
            title="Ajustar o cargar métricas reales directamente"
          >
            <Edit3 size={13} className="text-[#CCFF00]" />
            <span>Editar Datos Reales</span>
          </button>

          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${showApiConfig ? 'bg-[#CCFF00] text-black border-[#CCFF00]' : 'bg-white/5 text-white/80 border-white/10 hover:text-white hover:bg-white/10'}`}
          >
            <Key size={13} />
            <span>Token API Meta</span>
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

      {/* PESTAÑAS DE VISTA: PIPELINE CRM vs ESTADÍSTICAS vs RENDIMIENTO CONTENIDO vs ESTUDIO GUIONES */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-white/10 pb-3 gap-2.5">
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 overflow-x-auto scrollbar-hide max-w-full gap-1">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-[8.5px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${activeTab === 'pipeline' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0033]' : 'text-white/60 hover:text-white'}`}
          >
            <Layers size={13} />
            <span>Pipeline Leads ({leads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-[8.5px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${activeTab === 'analytics' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0033]' : 'text-white/60 hover:text-white'}`}
          >
            <BarChart3 size={13} />
            <span>Audiencia & Métricas</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`px-3 py-1.5 rounded-lg text-[8.5px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${activeTab === 'content' ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_#CCFF0033]' : 'text-white/60 hover:text-white'}`}
          >
            <Sparkles size={13} />
            <span>Top Reels & Posts</span>
          </button>

          <button
            onClick={() => setActiveTab('scripts')}
            className={`px-3 py-1.5 rounded-lg text-[8.5px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${activeTab === 'scripts' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_12px_rgba(221,42,123,0.4)]' : 'text-pink-300 hover:text-white hover:bg-pink-500/10'}`}
          >
            <Film size={13} />
            <span>🎬 Guiones & Edits</span>
          </button>

          <button
            onClick={() => setActiveTab('unfollowers')}
            className={`px-3 py-1.5 rounded-lg text-[8.5px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${activeTab === 'unfollowers' ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'text-red-300 hover:text-white hover:bg-red-500/10'}`}
          >
            <UserX size={13} />
            <span>🚫 No Me Siguen ({nonFollowers.filter(n => !n.unfollowed).length})</span>
          </button>
        </div>

        {/* ACCIÓN ASISTENTE IA INSTAGRAM & GUIONISTA */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
          <button
            onClick={() => onAskBot("@ReelArchitect Crea un guión viral para @tsteam.fit basado en la Regla del 3 y el entrenamiento de fuerza vs running. Dame: Gancho de 3s, estructura de B-Roll, música en tendencia y CTA para captar asesorías por DM.")}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 border border-pink-400/40 text-white text-[8.5px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(221,42,123,0.3)] shrink-0"
          >
            <Film size={12} className="text-[#CCFF00]" />
            <span>+ Guión con @ReelArchitect</span>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Ficha de Rendimiento por Publicación & Reel</h3>
                <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[8px] font-mono font-bold">@tsteam.fit</span>
              </div>
              <p className="text-[10px] text-white/40 font-mono mt-0.5">Diagnóstico del algoritmo 2026: Guardados (Saves), Compartidos (Shares), ER y Retención</p>
            </div>
            <button
              onClick={() => onAskBot("@InstaAnalyst Desglosa los 3 formatos de Reels con mayor ratio de retención y guardados para @tsteam.fit y escribe el guión de 1 Reel viral para esta semana.")}
              className="px-3.5 py-2 rounded-xl bg-[#CCFF00] text-black font-black text-[9px] uppercase tracking-wider hover:bg-white transition-all shadow-[0_0_10px_#CCFF0033] flex items-center gap-1.5"
            >
              <Sparkles size={12} />
              <span>+ Guión Viral con IA</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.recentMedia.map((m) => {
              const isTop = m.engagementRate >= 10;
              const hasHighSaves = m.savedCount >= 30;
              const saveToLikeRatio = m.likeCount > 0 ? ((m.savedCount / m.likeCount) * 100).toFixed(0) : '0';

              return (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-[#090909] border border-white/10 hover:border-pink-500/30 transition-all flex flex-col justify-between space-y-4 group shadow-xl relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div 
                      onClick={() => setPreviewVideoModal(m)}
                      className="w-full sm:w-32 h-48 sm:h-auto rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-white/10 cursor-pointer group/thumb shadow-lg"
                      title="Haz clic para ver la vista previa del Reel"
                    >
                      <img
                        src={m.mediaUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/10 transition-all flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#CCFF00] text-black flex items-center justify-center shadow-lg shadow-black/80 group-hover/thumb:scale-110 transition-transform">
                          <Play size={16} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/90 text-[8px] font-black text-[#CCFF00] uppercase font-mono flex items-center gap-1 border border-white/10">
                        <Play size={8} fill="#CCFF00" />
                        {m.mediaType === 'VIDEO' ? 'REEL' : m.mediaType === 'CAROUSEL_ALBUM' ? 'CARRUSEL' : 'POST'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Badges de Rendimiento */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono flex items-center gap-1 ${
                            isTop ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30'
                          }`}>
                            {isTop && <Flame size={10} className="text-amber-400" />}
                            ER: {m.engagementRate}%
                          </span>

                          {hasHighSaves && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                              <Bookmark size={9} />
                              {saveToLikeRatio}% Guardado
                            </span>
                          )}

                          <span className="text-[8px] text-white/40 font-mono ml-auto">
                            {new Date(m.timestamp).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Copy / Caption */}
                        <p className="text-[11px] text-white/90 line-clamp-3 leading-relaxed font-sans font-medium">
                          {m.caption}
                        </p>
                      </div>

                      {/* Tarjeta de Métricas Numéricas */}
                      <div className="grid grid-cols-4 gap-1.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[9.5px] font-mono">
                        <div className="flex flex-col items-center justify-center p-1 rounded bg-black/40 text-white/80">
                          <span className="text-red-400 font-bold flex items-center gap-1"><Heart size={10} /> {m.likeCount}</span>
                          <span className="text-[7px] text-white/30 uppercase mt-0.5">Likes</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-1 rounded bg-black/40 text-white/80">
                          <span className="text-blue-400 font-bold flex items-center gap-1"><MessageCircle size={10} /> {m.commentsCount}</span>
                          <span className="text-[7px] text-white/30 uppercase mt-0.5">Coments</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-1 rounded bg-black/40 text-[#CCFF00]">
                          <span className="font-bold flex items-center gap-1"><Bookmark size={10} /> {m.savedCount}</span>
                          <span className="text-[7px] text-white/30 uppercase mt-0.5">Saves</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-1 rounded bg-black/40 text-pink-300">
                          <span className="font-bold flex items-center gap-1"><Share2 size={10} /> {m.sharesCount}</span>
                          <span className="text-[7px] text-white/30 uppercase mt-0.5">Shares</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la Ficha */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewVideoModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#CCFF00]/10 hover:bg-[#CCFF00] hover:text-black text-[#CCFF00] text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-[#CCFF00]/30"
                      >
                        <Play size={10} fill="currentColor" />
                        <span>Vista Previa</span>
                      </button>

                      <button
                        onClick={() => setSelectedMediaForDetails(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 border border-white/10"
                      >
                        <BarChart3 size={10} className="text-[#CCFF00]" />
                        <span>Ficha 360°</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAskBot(`@ReelArchitect A partir del Reel de @tsteam.fit ("${m.caption.slice(0, 90)}..."), crea un nuevo guión viral 2.0 con un gancho de 3 segundos mejorado, formato de cortes rápidos para CapCut y llamada a la acción para captar asesorías por DM.`)}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[8.5px] font-black uppercase tracking-wider transition-all border border-purple-500/30 flex items-center gap-1"
                        title="Crear guión derivado con ReelArchitect"
                      >
                        <Film size={10} />
                        <span>Guión 2.0</span>
                      </button>

                      <a
                        href={m.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-pink-400 hover:bg-pink-500/10 transition-all border border-white/5"
                        title="Ver Reel en Instagram"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA 4: ESTUDIO DE GUIONES VIRALES & PLANTILLAS (CAPCUT/PREMIERE) */}
      {/* ============================================================ */}
      {activeTab === 'scripts' && (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
          
          {/* Header del Estudio de Guiones */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0E0E12] via-[#140E1B] to-[#0A1210] border border-pink-500/20 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1">
                  <Film size={11} />
                  @ReelArchitect AI Studio
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30 text-[8px] font-mono font-bold">
                  Tendencias 2026
                </span>
              </div>
              <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-white">
                Guiones Virales & Plantillas de Edición para <span className="text-[#CCFF00]">@tsteam.fit</span>
              </h2>
              <p className="text-[11px] text-white/60 font-sans max-w-2xl leading-relaxed">
                Estructuras probadas de 30 a 45 segundos con <strong className="text-white">Ganchos de 3s</strong>, retención de B-Roll, subtítulos de alto contraste y llamadas a la acción para captar clientes por DM.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => onAskBot("@ReelArchitect Genera 3 ideas de Reels virales para @tsteam.fit teniendo en cuenta las tendencias fitness de esta semana (Entrenamiento Híbrido, Fuerza pesada + Running, Automatización de coaches). Incluye gancho, minutaje segundo a segundo y plantilla para CapCut.")}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-white text-black font-black text-[9.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_#CCFF0044]"
              >
                <Sparkles size={13} />
                <span>+ Generar Guiones Nuevos con IA</span>
              </button>
            </div>
          </div>

          {/* Filtros de Categoría */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'todos', label: 'Todos los Formatos' },
              { id: 'viral', label: '🔥 Ganchos Virales' },
              { id: 'ciencia', label: '🧬 Ciencia & Rendimiento' },
              { id: 'habitos', label: '📅 Disciplina & Mentalidad' },
              { id: 'coaches', label: '💼 Ecosistema Coaches' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedScriptCategory(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                  selectedScriptCategory === cat.id
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid de Guiones & Plantillas Exportables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* GUION 1: La Regla del 3 */}
            {(selectedScriptCategory === 'todos' || selectedScriptCategory === 'habitos' || selectedScriptCategory === 'viral') && (
              <div className="p-5 rounded-2xl bg-[#090909] border border-white/10 hover:border-pink-500/40 transition-all flex flex-col justify-between space-y-4 relative group shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-mono font-bold uppercase">
                      ⭐ Formato Retención
                    </span>
                    <span className="text-[8.5px] font-mono text-white/40">Duración: 28s</span>
                  </div>

                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    1. La Regla del 3 (Quiebre de Motivación)
                  </h3>

                  {/* Estructura del Guión */}
                  <div className="space-y-2 text-[10px] font-mono bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                    <div className="text-pink-300 font-bold">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:00 - 0:03 ⚡ Gancho Visual:</span>
                      "La mayoría fracasa porque confunde la emoción del primer día con el proceso real de cambiar de vida."
                    </div>
                    <div className="text-white/80">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:03 - 0:22 🎬 Desarrollo:</span>
                      "La regla del 3 no falla: A los 3 días tenés motivación. A las 3 semanas construís un hábito. A los 3 meses ves resultados. A los 3 años tu vida es completamente otra."
                    </div>
                    <div className="text-[#CCFF00] font-bold">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:22 - 0:28 🚀 CTA de Conversión:</span>
                      "👇 Comentá la palabra: LAB y mi sistema te envía el acceso directo a nuestro hub de Notion al privado."
                    </div>
                  </div>

                  {/* Plantilla de Edición para CapCut / Premiere */}
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2 text-[9px] font-mono text-white/70">
                    <div className="flex items-center justify-between text-[#CCFF00] text-[8px] font-bold uppercase">
                      <span className="flex items-center gap-1"><Scissors size={10} /> Plantilla CapCut / Premiere</span>
                      <span>124 BPM</span>
                    </div>
                    <p>• <strong>Tomas B-Roll:</strong> Primer plano atando zapatillas de running ➔ sentadilla pesada ➔ pantalla iPad Notion.</p>
                    <p>• <strong>Cortes:</strong> Cada 1.8 segundos con micro-zoom in.</p>
                    <p>• <strong>Subtítulos:</strong> Fuente negrita centrada, palabras clave en <span className="text-[#CCFF00]">#CCFF00</span>.</p>
                    <p>• <strong>Audio SFX:</strong> Whoosh en transiciones + sonido de notificación al decir "LAB".</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      const text = `GUION REEL: La Regla del 3\n\n[0:00-0:03 GANCHO]\n"La mayoría fracasa porque confunde la emoción del primer día con el proceso real de cambiar de vida."\n\n[0:03-0:22 DESARROLLO]\n"La regla del 3 no falla:\n- A los 3 días tenés motivación.\n- A las 3 semanas construís un hábito.\n- A los 3 meses ves resultados.\n- A los 3 años tu vida es completamente otra."\n\n[0:22-0:28 CTA]\n"👇 Comentá la palabra: LAB y mi sistema te envía el acceso directo a nuestro hub de Notion al privado."\n\n[PLANTILLA EDICIÓN CAPCUT]\n- B-Roll: Zapatillas running + sentadilla + Notion\n- Pacing: Cortes a 1.8s con zoom-in\n- Audio: Phonk / Lo-fi 124 BPM + Woosh SFX`;
                      navigator.clipboard.writeText(text);
                      setCopiedScriptId('script-1');
                      setTimeout(() => setCopiedScriptId(null), 2000);
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[8.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-white/10"
                  >
                    {copiedScriptId === 'script-1' ? <Check size={11} className="text-[#CCFF00]" /> : <Copy size={11} />}
                    <span>{copiedScriptId === 'script-1' ? '¡Copiado!' : 'Copiar Plantilla'}</span>
                  </button>

                  <button
                    onClick={() => onAskBot("@ReelArchitect Ajusta el guión 'La Regla del 3' para enfocarlo 100% en captar alumnos para mi asesoría personalizada de entrenamiento híbrido de @tsteam.fit.")}
                    className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    title="Pedir variante a ReelArchitect"
                  >
                    <Sparkles size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* GUION 2: Fuerza vs Running */}
            {(selectedScriptCategory === 'todos' || selectedScriptCategory === 'ciencia' || selectedScriptCategory === 'viral') && (
              <div className="p-5 rounded-2xl bg-[#090909] border border-white/10 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-4 relative group shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-[#CCFF00]/20 text-[#CCFF00] border border-[#CCFF00]/30 text-[8px] font-mono font-bold uppercase">
                      🧬 Ciencia & Rendimiento
                    </span>
                    <span className="text-[8.5px] font-mono text-white/40">Duración: 32s</span>
                  </div>

                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    2. Mito del Atleta Híbrido (Fuerza vs Running)
                  </h3>

                  {/* Estructura del Guión */}
                  <div className="space-y-2 text-[10px] font-mono bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                    <div className="text-pink-300 font-bold">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:00 - 0:03 ⚡ Gancho Visual:</span>
                      "Te dijeron que correr te hacía perder masa muscular. Te mintieron para venderte rutinas aburridas."
                    </div>
                    <div className="text-white/80">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:03 - 0:24 🎬 Desarrollo:</span>
                      "La ciencia demuestra que cuando combinas carrera en Zona 2 con sobrecarga progresiva en sentadilla y peso muerto, tu capacidad mitocondrial y tu hipertrofia se multiplican sin fatiga central."
                    </div>
                    <div className="text-[#CCFF00] font-bold">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:24 - 0:32 🚀 CTA de Conversión:</span>
                      "Comentá HIBRIDO y te envío la guía de periodización de fuerza y running que usamos en @tsteam.fit."
                    </div>
                  </div>

                  {/* Plantilla de Edición para CapCut / Premiere */}
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2 text-[9px] font-mono text-white/70">
                    <div className="flex items-center justify-between text-[#CCFF00] text-[8px] font-bold uppercase">
                      <span className="flex items-center gap-1"><Scissors size={10} /> Plantilla CapCut / Premiere</span>
                      <span>130 BPM</span>
                    </div>
                    <p>• <strong>Tomas B-Roll:</strong> Split screen carrera intensa en asfalto vs barra cargada con 140kg.</p>
                    <p>• <strong>Cortes:</strong> Transición con latido cardíaco sonoro y gráfica de pulsaciones.</p>
                    <p>• <strong>Subtítulos:</strong> Dinámicos palabra por palabra con pop-up.</p>
                    <p>• <strong>Audio SFX:</strong> Sub-bass drop en el gancho y click en el CTA.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      const text = `GUION REEL: Mito del Atleta Híbrido\n\n[0:00-0:03 GANCHO]\n"Te dijeron que correr te hacía perder masa muscular. Te mintieron para venderte rutinas aburridas."\n\n[0:03-0:24 DESARROLLO]\n"La ciencia demuestra que cuando combinas carrera en Zona 2 con sobrecarga progresiva en sentadilla y peso muerto, tu capacidad mitocondrial y tu hipertrofia se multiplican sin fatiga central."\n\n[0:24-0:32 CTA]\n"Comentá HIBRIDO y te envío la guía de periodización de fuerza y running que usamos en @tsteam.fit."\n\n[PLANTILLA EDICIÓN CAPCUT]\n- B-Roll: Split screen carrera vs sentadilla pesada\n- Pacing: Dinámico con ritmo de respiración y pulsaciones\n- Audio: Synthwave / Phonk 130 BPM + Sub-bass drop`;
                      navigator.clipboard.writeText(text);
                      setCopiedScriptId('script-2');
                      setTimeout(() => setCopiedScriptId(null), 2000);
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[8.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-white/10"
                  >
                    {copiedScriptId === 'script-2' ? <Check size={11} className="text-[#CCFF00]" /> : <Copy size={11} />}
                    <span>{copiedScriptId === 'script-2' ? '¡Copiado!' : 'Copiar Plantilla'}</span>
                  </button>

                  <button
                    onClick={() => onAskBot("@ReelArchitect Adapta el guión de Atleta Híbrido para crear un Reel de demostración práctica en el gimnasio explicando cómo no sobrecargar las rodillas.")}
                    className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    title="Pedir variante a ReelArchitect"
                  >
                    <Sparkles size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* GUION 3: Ecosistema para Coaches */}
            {(selectedScriptCategory === 'todos' || selectedScriptCategory === 'coaches') && (
              <div className="p-5 rounded-2xl bg-[#090909] border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4 relative group shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[8px] font-mono font-bold uppercase">
                      💼 Ecosistema Coaches
                    </span>
                    <span className="text-[8.5px] font-mono text-white/40">Duración: 30s</span>
                  </div>

                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    3. Gana +10h/semana (Automatización de Entrenadores)
                  </h3>

                  {/* Estructura del Guión */}
                  <div className="space-y-2 text-[10px] font-mono bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                    <div className="text-pink-300 font-bold">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:00 - 0:03 ⚡ Gancho Visual:</span>
                      "Si pasas más de 3 horas al día respondiendo WhatsApp a tus alumnos, no tienes un negocio, tienes una jaula."
                    </div>
                    <div className="text-white/80">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:03 - 0:22 🎬 Desarrollo:</span>
                      "En TJ Fitlab creamos un ecosistema digital que automatiza la entrega de rutinas, el feedback de técnica y el CRM para que dupliques tus alumnos sin perder calidad."
                    </div>
                    <div className="text-[#CCFF00] font-bold">
                      <span className="text-white/40 block text-[7.5px] uppercase">0:22 - 0:30 🚀 CTA de Conversión:</span>
                      "Comentá la palabra SISTEMA y te muestro el backend de nuestro laboratorio por dentro."
                    </div>
                  </div>

                  {/* Plantilla de Edición para CapCut / Premiere */}
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2 text-[9px] font-mono text-white/70">
                    <div className="flex items-center justify-between text-[#CCFF00] text-[8px] font-bold uppercase">
                      <span className="flex items-center gap-1"><Scissors size={10} /> Plantilla CapCut / Premiere</span>
                      <span>120 BPM</span>
                    </div>
                    <p>• <strong>Tomas B-Roll:</strong> Grabación de pantalla del dashboard de métricas + café mañanero + MacBook.</p>
                    <p>• <strong>Cortes:</strong> Estilo documental minimalista con zooms suaves.</p>
                    <p>• <strong>Subtítulos:</strong> Fuente clean tech en blanco con badge púrpura.</p>
                    <p>• <strong>Audio SFX:</strong> Sonido de typing y teclado mecánico en los quiebres de texto.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      const text = `GUION REEL: Automatización para Coaches\n\n[0:00-0:03 GANCHO]\n"Si pasas más de 3 horas al día respondiendo WhatsApp a tus alumnos, no tienes un negocio, tienes una jaula."\n\n[0:03-0:22 DESARROLLO]\n"En TJ Fitlab creamos un ecosistema digital que automatiza la entrega de rutinas, el feedback de técnica y el CRM para que dupliques tus alumnos sin perder calidad."\n\n[0:22-0:30 CTA]\n"Comentá la palabra SISTEMA y te muestro el backend de nuestro laboratorio por dentro."\n\n[PLANTILLA EDICIÓN CAPCUT]\n- B-Roll: Grabación de pantalla CRM + MacBook + café\n- Pacing: Estilo documental tech\n- Audio: Lo-fi moderno 120 BPM + Keyboard SFX`;
                      navigator.clipboard.writeText(text);
                      setCopiedScriptId('script-3');
                      setTimeout(() => setCopiedScriptId(null), 2000);
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[8.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-white/10"
                  >
                    {copiedScriptId === 'script-3' ? <Check size={11} className="text-[#CCFF00]" /> : <Copy size={11} />}
                    <span>{copiedScriptId === 'script-3' ? '¡Copiado!' : 'Copiar Plantilla'}</span>
                  </button>

                  <button
                    onClick={() => onAskBot("@ReelArchitect Diseña un guión para convencer a otros entrenadores personales de usar la plataforma de TJ Fitlab para gestionar sus alumnos.")}
                    className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    title="Pedir variante a ReelArchitect"
                  >
                    <Sparkles size={13} />
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Matriz de Estrategia de Crecimiento 2026 para @tsteam.fit */}
          <div className="p-5 md:p-6 rounded-2xl bg-[#090909] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket size={16} className="text-[#CCFF00]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Estrategia de Crecimiento & Tendencias Algoritmo 2026 (@tsteam.fit)
                </h3>
              </div>
              <span className="text-[8.5px] font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded">
                Meta Creator Playbook
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-sans text-white/70">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <h4 className="font-black text-white text-[11px] uppercase flex items-center gap-1.5">
                  <span className="text-[#CCFF00] font-mono">1.</span> La Regla de los 3 Segundos
                </h4>
                <p className="leading-relaxed">
                  El algoritmo de Meta descarta los Reels que no retienen al menos al 40% de la audiencia en los primeros 3 segundos. Comienza siempre con movimiento visual inmediato y una frase en negativo o afirmación contraintuitiva.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <h4 className="font-black text-white text-[11px] uppercase flex items-center gap-1.5">
                  <span className="text-[#CCFF00] font-mono">2.</span> Disparador de Palabras Clave (DMs)
                </h4>
                <p className="leading-relaxed">
                  En lugar de pedir "link en bio", pide que comenten una palabra clave corta (ej: <strong className="text-white">LAB</strong> o <strong className="text-white">SISTEMA</strong>). Esto genera señales masivas de comentarios y activa la conversación privada directa.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <h4 className="font-black text-white text-[11px] uppercase flex items-center gap-1.5">
                  <span className="text-[#CCFF00] font-mono">3.</span> Ratio de Guardados (Saves)
                </h4>
                <p className="leading-relaxed">
                  Un Reel que supera el 10% de guardados sobre likes es recomendado automáticamente por Instagram en la pestaña Explorar por más de 14 días. Asegúrate de incluir datos aplicables o plantillas.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA 5: AUDITORÍA DE NO SEGUIDORES (UNFOLLOW HUB) */}
      {/* ============================================================ */}
      {activeTab === 'unfollowers' && (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
          
          {/* Header del Unfollow Hub */}
          <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-[#140A0D] via-[#1A0E13] to-[#0A0D14] border border-red-500/20 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1">
                  <UserX size={11} />
                  Auditoría de Cuentas & Purga
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[8px] font-mono font-bold flex items-center gap-1">
                  <ShieldAlert size={10} />
                  Protección Anti-Bloqueo
                </span>
              </div>
              <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-white">
                Cuentas que <span className="text-red-400">No Te Siguen de Vuelta</span> en @tsteam.fit
              </h2>
              <p className="text-[11px] text-white/60 font-sans max-w-2xl leading-relaxed">
                Optimiza tu ratio de seguimiento y purga perfiles inactivos o bots. Sincroniza mediante <strong className="text-white">Archivos Oficiales de Instagram (.JSON)</strong> o escanea interacciones en vivo con la <strong className="text-white">Meta Graph API</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => {
                  setJsonImportTab('upload');
                  setShowImportAccountsModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
              >
                <UploadCloud size={13} className="text-[#CCFF00]" />
                <span>📁 Cargar JSON Instagram</span>
              </button>

              <button
                onClick={handleScanMetaApiComments}
                disabled={isScanningApiUsers}
                className="px-3.5 py-2 rounded-xl bg-[#CCFF00]/10 hover:bg-[#CCFF00] hover:text-black text-[#CCFF00] font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 border border-[#CCFF00]/30 disabled:opacity-50"
              >
                <RefreshCw size={12} className={isScanningApiUsers ? "animate-spin" : ""} />
                <span>{isScanningApiUsers ? "Escaneando..." : "⚡ Escanear Meta API"}</span>
              </button>

              <button
                onClick={() => onAskBot("@InstaAnalyst Realiza una auditoría del ratio de seguidos vs seguidores de @tsteam.fit (1,117 seguidos vs 1,099 seguidores). ¿Qué impacto tiene en el algoritmo de Meta tener más seguidos que seguidores y cuál es la estrategia recomendada para depurar la lista?")}
                className="px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                <Sparkles size={12} />
                <span>Estrategia IA</span>
              </button>
            </div>
          </div>

          {/* Banner Explicativo de Integración con Meta API & Exportación Oficial */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10px] font-sans">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-[#CCFF00]/10 text-[#CCFF00] flex-shrink-0 mt-0.5">
                <HelpCircle size={15} />
              </div>
              <div className="space-y-1">
                <div className="text-white font-bold flex items-center gap-2">
                  <span>¿Cómo obtener tus datos 100% reales sin riesgo de baneo?</span>
                  <span className="text-[8px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded font-mono uppercase">Seguridad Meta 2026</span>
                </div>
                <p className="text-white/60 leading-relaxed max-w-3xl">
                  Por políticas de privacidad (GDPR de Meta), la Graph API no lista nombres privados de seguidores en endpoints abiertos. La forma oficial y 100% segura que usan las agencias es: <strong className="text-white">Instagram &rarr; Tu Actividad &rarr; Descargar Información &rarr; Formato JSON</strong>. Luego subes tu <code className="text-[#CCFF00] bg-black/40 px-1 rounded">following.json</code> y <code className="text-[#CCFF00] bg-black/40 px-1 rounded">followers_1.json</code> aquí y el sistema te filtra exactamente quién no te sigue en 1 segundo.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setJsonImportTab('upload');
                setShowImportAccountsModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-[8.5px] uppercase whitespace-nowrap flex items-center gap-1 self-end md:self-auto"
            >
              <FolderArchive size={11} className="text-[#CCFF00]" />
              <span>Ver Guía & Subir</span>
            </button>
          </div>

          {/* Tarjetas de Métricas del Hub */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Cuentas que Sigues</span>
              <div className="text-xl md:text-2xl font-black text-white font-mono">{ov?.followsCount || 1117}</div>
              <span className="text-[8px] text-white/30 font-mono">Total seguidos</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[8.5px] font-black uppercase tracking-widest text-white/40">Tus Seguidores</span>
              <div className="text-xl md:text-2xl font-black text-[#CCFF00] font-mono">{ov?.followersCount || 1099}</div>
              <span className="text-[8px] text-green-400 font-mono">Comunidad activa</span>
            </div>

            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-1">
              <span className="text-[8.5px] font-black uppercase tracking-widest text-red-400/70">No Te Siguen (Detectados)</span>
              <div className="text-xl md:text-2xl font-black text-red-400 font-mono">
                {nonFollowers.filter(n => !n.unfollowed).length}
              </div>
              <span className="text-[8px] text-red-300/60 font-mono">Cuentas a revisar</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <div className="flex justify-between items-center text-amber-400/80">
                <span className="text-[8.5px] font-black uppercase tracking-widest">Límite Seguro Hoy</span>
                <span className="text-[9px] font-mono">{unfollowedCountToday} / 50</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-amber-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min((unfollowedCountToday / 50) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[7.5px] text-white/40 font-mono block mt-1">Máx 50/hora recomendado</span>
            </div>
          </div>

          {/* Filtros & Buscador de No Seguidores */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2 flex-grow max-w-md bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Search size={14} className="text-white/40" />
              <input
                type="text"
                value={unfollowSearch}
                onChange={(e) => setUnfollowSearch(e.target.value)}
                placeholder="Buscar cuenta por @usuario o nombre..."
                className="bg-transparent text-xs text-white placeholder-white/40 outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'no_sigue', label: '❌ No Te Siguen' },
                { id: 'inactivo', label: '⚠️ Inactivos' },
                { id: 'marca_bot', label: '🏢 Marcas/Bots' },
                { id: 'unfollowed', label: '✓ Dejados de Seguir' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setUnfollowFilter(f.id as any)}
                  className={`px-3 py-1 rounded-lg text-[8.5px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                    unfollowFilter === f.id
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Cuentas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonFollowers
              .filter(acc => {
                const matchesFilter = 
                  unfollowFilter === 'todos' ? true :
                  unfollowFilter === 'unfollowed' ? acc.unfollowed :
                  !acc.unfollowed && acc.tipo === unfollowFilter;
                const matchesSearch = 
                  acc.username.toLowerCase().includes(unfollowSearch.toLowerCase()) ||
                  acc.nombre.toLowerCase().includes(unfollowSearch.toLowerCase());
                return matchesFilter && matchesSearch;
              })
              .map((acc) => (
                <div
                  key={acc.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 shadow-xl ${
                    acc.unfollowed
                      ? 'bg-white/[0.01] border-white/5 opacity-50'
                      : 'bg-[#090909] border-white/10 hover:border-red-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/10 flex-shrink-0">
                        <img src={acc.avatarUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://www.instagram.com/${acc.username}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-black text-white hover:text-red-400 transition-colors flex items-center gap-1 font-mono"
                          >
                            <span>@{acc.username}</span>
                            <ExternalLink size={9} />
                          </a>
                        </div>
                        <p className="text-[10px] text-white/50">{acc.nombre}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[7.5px] font-black uppercase font-mono border ${
                      acc.unfollowed
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : acc.tipo === 'inactivo'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : acc.tipo === 'marca_bot'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        : 'bg-red-500/10 text-red-300 border-red-500/20'
                    }`}>
                      {acc.unfollowed ? '✓ Purga lista' : acc.tipo === 'inactivo' ? '⚠️ Inactivo' : acc.tipo === 'marca_bot' ? '🏢 Marca/Bot' : '❌ No te sigue'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] font-mono space-y-1 text-white/60">
                    <div className="flex justify-between">
                      <span>Seguido:</span>
                      <span className="text-white/80">{acc.seguidoDesde}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diagnóstico:</span>
                      <span className="text-red-400 font-bold">{acc.interaccion}</span>
                    </div>
                  </div>

                  {/* Acciones de Cuenta */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <a
                      href={`https://www.instagram.com/${acc.username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 hover:text-white text-red-300 text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-red-500/20"
                    >
                      <ExternalLink size={10} />
                      <span>Dejar de Seguir</span>
                    </a>

                    <button
                      onClick={() => handleToggleUnfollow(acc.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[8.5px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1 ${
                        acc.unfollowed
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                      }`}
                    >
                      {acc.unfollowed ? <Check size={10} /> : <UserMinus size={10} />}
                      <span>{acc.unfollowed ? 'Listo' : 'Marcar'}</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR CUENTAS NO SEGUIDORAS */}
      {showImportAccountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowImportAccountsModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              ✕
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-black flex-shrink-0">
                <UserPlus size={19} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Sincronizador de Datos Reales</h3>
                <p className="text-[9.5px] text-white/40 font-mono">Importa tus 1,117 seguidos y 1,099 seguidores reales para auditar no seguidores</p>
              </div>
            </div>

            {/* Switcher de Métodos de Importación */}
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 gap-1 mb-5">
              <button
                type="button"
                onClick={() => {
                  setJsonImportTab('upload');
                  setUploadStatusMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  jsonImportTab === 'upload' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <UploadCloud size={12} />
                <span>1. Archivos JSON Oficiales</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJsonImportTab('api_scan');
                  setUploadStatusMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  jsonImportTab === 'api_scan' ? 'bg-[#CCFF00] text-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <RefreshCw size={12} />
                <span>2. Escáner Meta API</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJsonImportTab('text');
                  setUploadStatusMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  jsonImportTab === 'text' ? 'bg-red-500 text-white shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <FileCode size={12} />
                <span>3. Pegar Lista</span>
              </button>
            </div>

            {uploadStatusMsg && (
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-mono text-white mb-4 flex items-center justify-between">
                <span>{uploadStatusMsg}</span>
                <span className="text-[8px] opacity-40 font-bold uppercase">Estado</span>
              </div>
            )}

            {/* TAB 1: SUBIR ARCHIVOS JSON OFICIALES */}
            {jsonImportTab === 'upload' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* File Input 1: following.json */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-dashed border-white/15 hover:border-red-500/40 transition-all text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/60">
                      <FolderArchive size={15} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-white font-mono">1. following.json</div>
                      <div className="text-[7.5px] text-white/40 font-mono">Cuentas que sigues ({followingJsonData?.length || '0'} cargados)</div>
                    </div>
                    <label className="block cursor-pointer py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[8.5px] font-black text-white uppercase tracking-wider transition-all">
                      <span>Seleccionar Archivo</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={(e) => handleProcessFile(e, 'following')} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  {/* File Input 2: followers_1.json */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-dashed border-white/15 hover:border-green-500/40 transition-all text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/60">
                      <FolderArchive size={15} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-white font-mono">2. followers_1.json</div>
                      <div className="text-[7.5px] text-white/40 font-mono">Tus seguidores ({followersJsonData?.length || '0'} cargados)</div>
                    </div>
                    <label className="block cursor-pointer py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[8.5px] font-black text-white uppercase tracking-wider transition-all">
                      <span>Seleccionar Archivo</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={(e) => handleProcessFile(e, 'followers')} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {/* Guía Rápida */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-[9.5px] text-white/60 font-sans">
                  <div className="font-bold text-white uppercase text-[8px] tracking-wider flex items-center gap-1">
                    <Download size={11} className="text-[#CCFF00]" />
                    ¿Cómo exportar tus archivos oficiales en 30 segundos?
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-white/50 text-[9px] leading-relaxed">
                    <li>Abre Instagram en tu teléfono &rarr; <strong>Ajustes</strong> &rarr; <strong>Tu actividad</strong>.</li>
                    <li>Toca <strong>Descargar tu información</strong> &rarr; <strong>Descargar información</strong>.</li>
                    <li>Elige <strong>Parte de tu información</strong> &rarr; marca <strong>Seguidores y seguidos</strong>.</li>
                    <li>Selecciona formato <strong>JSON</strong> y rango <strong>Desde el principio</strong>.</li>
                    <li>Sube aquí los dos archivos y el CRM te calcula el 100% de no seguidores exactos.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  disabled={!followingJsonData}
                  onClick={handleCompareAndApplyJson}
                  className="w-full bg-[#CCFF00] hover:bg-white text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_#CCFF0033] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Comparar & Aplicar Lista Real ({followingJsonData ? `${followingJsonData.length} seguidos` : 'Sube following.json'})</span>
                </button>
              </div>
            )}

            {/* TAB 2: ESCÁNER META GRAPH API */}
            {jsonImportTab === 'api_scan' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 text-[10px] font-sans">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#CCFF00]" />
                    Escaneo de Interacciones Reales en Meta Graph API
                  </div>
                  <p className="text-white/60 leading-relaxed">
                    La API de Meta conectada a tu cuenta <strong className="text-white">@tsteam.fit</strong> analizará en tiempo real los comentarios y usuarios que han interactuado con tus 91 publicaciones y Reels para identificar prospectos y contactos activos.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isScanningApiUsers}
                  onClick={handleScanMetaApiComments}
                  className="w-full bg-[#CCFF00] hover:bg-white text-black font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_#CCFF0033] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isScanningApiUsers ? "animate-spin" : ""} />
                  <span>{isScanningApiUsers ? "Consultando Meta Graph API..." : "Ejecutar Escaneo en Vivo"}</span>
                </button>
              </div>
            )}

            {/* TAB 3: PEGAR LISTA MANUAL */}
            {jsonImportTab === 'text' && (
              <form onSubmit={handleImportCustomNonFollowers} className="space-y-4">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">
                    Usuarios de Instagram (@)
                  </label>
                  <textarea
                    value={importAccountsText}
                    onChange={(e) => setImportAccountsText(e.target.value)}
                    placeholder={"@usuario1\n@usuario2\n@marca_ejemplo"}
                    rows={5}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-red-500 font-mono resize-none"
                  />
                  <span className="text-[8px] text-white/30 block mt-1">
                    Puedes separar los nombres con saltos de línea o comas.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Cargar en el Unfollow Hub
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL VISTA PREVIA INTERACTIVA DE VIDEO / REEL SIMULATOR */}
      {previewVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg p-3 md:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/20 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.95)] flex flex-col relative">
            
            {/* Header del Reproductor */}
            <div className="p-3.5 border-b border-white/10 bg-black/80 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px]">
                  <img src="/avatars/instaanalyst.png" alt="" className="w-full h-full rounded-full object-cover" />
                </div>
                <div>
                  <div className="text-[10.5px] font-black text-white font-mono">@tsteam.fit</div>
                  <div className="text-[7.5px] text-white/40 font-mono">Instagram Reel Preview</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={previewVideoModal.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-pink-500/20 text-pink-300 hover:bg-pink-500 hover:text-white text-[8px] font-mono font-bold flex items-center gap-1 transition-all"
                >
                  <span>Abrir App</span>
                  <ExternalLink size={9} />
                </a>
                <button
                  onClick={() => setPreviewVideoModal(null)}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Pantalla 9:16 del Reel Simulator */}
            <div className="relative aspect-[9/16] w-full bg-black flex items-center justify-center overflow-hidden group">
              <img
                src={previewVideoModal.mediaUrl}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Overlay interactivo de reproducción */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 flex flex-col justify-between p-4">
                
                {/* Badge Superior */}
                <div className="flex justify-between items-center">
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[8px] font-mono text-[#CCFF00] font-black border border-white/10">
                    ER: {previewVideoModal.engagementRate}%
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[8px] font-mono text-white/70">
                    {new Date(previewVideoModal.timestamp).toLocaleDateString()}
                  </span>
                </div>

                {/* Centro con botón play simulado */}
                <div className="flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[#CCFF00] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform cursor-pointer">
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </div>
                </div>

                {/* Métricas laterales estilo Instagram */}
                <div className="flex justify-between items-end">
                  <div className="space-y-2 max-w-[80%]">
                    <p className="text-[11px] text-white/95 line-clamp-3 leading-snug font-sans drop-shadow-md">
                      {previewVideoModal.caption}
                    </p>
                    <div className="flex items-center gap-2 text-[8px] font-mono text-white/60">
                      <span className="flex items-center gap-1"><Volume2 size={9} /> Audio Original &bull; @tsteam.fit</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3 pb-1">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-red-400 flex items-center justify-center border border-white/10">
                        <Heart size={14} />
                      </div>
                      <span className="text-[8px] text-white font-mono mt-0.5">{previewVideoModal.likeCount}</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-blue-400 flex items-center justify-center border border-white/10">
                        <MessageCircle size={14} />
                      </div>
                      <span className="text-[8px] text-white font-mono mt-0.5">{previewVideoModal.commentsCount}</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-[#CCFF00] flex items-center justify-center border border-white/10">
                        <Bookmark size={14} />
                      </div>
                      <span className="text-[8px] text-white font-mono mt-0.5">{previewVideoModal.savedCount}</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-pink-400 flex items-center justify-center border border-white/10">
                        <Share2 size={14} />
                      </div>
                      <span className="text-[8px] text-white font-mono mt-0.5">{previewVideoModal.sharesCount}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Acciones de Footer del Simulador */}
            <div className="p-3 bg-black/90 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const media = previewVideoModal;
                  setPreviewVideoModal(null);
                  setSelectedMediaForDetails(media);
                }}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[8.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-white/10"
              >
                <BarChart3 size={11} className="text-[#CCFF00]" />
                <span>Ver Ficha 360°</span>
              </button>

              <button
                onClick={() => {
                  const media = previewVideoModal;
                  setPreviewVideoModal(null);
                  onAskBot(`@ReelArchitect Crea un guión viral 2.0 derivado de este Reel de @tsteam.fit: "${media.caption.slice(0, 90)}...".`);
                }}
                className="flex-1 py-2 rounded-xl bg-[#CCFF00] hover:bg-white text-black font-black text-[8.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-[0_0_10px_#CCFF0033]"
              >
                <Film size={11} />
                <span>Guión con IA</span>
              </button>
            </div>

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
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Valor Estimado (€)</label>
                  <input
                    type="number"
                    value={newLeadValue}
                    onChange={(e) => setNewLeadValue(Number(e.target.value))}
                    placeholder="120"
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

      {/* MODAL AJUSTAR MÉTRICAS REALES DE @TSTEAM.FIT */}
      {showEditMetricsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in">
          <div className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowEditMetricsModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#CCFF00] flex items-center justify-center text-black">
                <Edit3 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Ajustar Métricas de @tsteam.fit</h3>
                <p className="text-[9px] text-white/40 font-mono">Actualiza tus estadísticas para que el CRM y el Bot IA usen tus datos reales</p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomMetrics} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Total de Seguidores</label>
                  <input
                    type="number"
                    value={editFollowers}
                    onChange={(e) => setEditFollowers(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Total de Publicaciones</label>
                  <input
                    type="number"
                    value={editMediaCount}
                    onChange={(e) => setEditMediaCount(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Engagement Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editEngagementRate}
                    onChange={(e) => setEditEngagementRate(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Alcance Mensual</label>
                  <input
                    type="number"
                    value={editMonthlyReach}
                    onChange={(e) => setEditMonthlyReach(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Impresiones</label>
                  <input
                    type="number"
                    value={editWeeklyImpressions}
                    onChange={(e) => setEditWeeklyImpressions(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">Biografía de @tsteam.fit</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#CCFF00]/40 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#CCFF00] hover:bg-white text-black font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_#CCFF0033]"
              >
                Aplicar Métricas Reales a @tsteam.fit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FICHA DE RENDIMIENTO 360° DE PUBLICACIÓN / REEL */}
      {selectedMediaForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#090909] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="p-4 md:p-5 border-b border-white/10 bg-black/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#CCFF00] text-black flex items-center justify-center font-black">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-white">Ficha de Rendimiento 360°</h3>
                    <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[8px] font-mono font-bold">
                      {selectedMediaForDetails.mediaType === 'VIDEO' ? 'REEL' : selectedMediaForDetails.mediaType === 'CAROUSEL_ALBUM' ? 'CARRUSEL' : 'POST'}
                    </span>
                  </div>
                  <p className="text-[8.5px] text-white/40 font-mono">
                    Publicado el {new Date(selectedMediaForDetails.timestamp).toLocaleDateString()} &bull; ID: {selectedMediaForDetails.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a 
                  href={selectedMediaForDetails.permalink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-pink-500/10 text-pink-300 hover:text-white hover:bg-pink-500/20 text-[9px] font-mono font-bold flex items-center gap-1 border border-pink-500/20"
                >
                  <span>Ver en Instagram</span>
                  <ExternalLink size={10} />
                </a>
                <button
                  onClick={() => setSelectedMediaForDetails(null)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 scrollbar-hide">
              {/* Resumen Superior & Tarjeta Visual */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-full sm:w-28 h-36 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10 relative">
                  <img
                    src={selectedMediaForDetails.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                    <span className="text-[8px] font-black text-[#CCFF00] font-mono">
                      ER: {selectedMediaForDetails.engagementRate}%
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Texto de la Publicación:</span>
                    <span className="text-[8px] font-mono text-[#CCFF00]">
                      {selectedMediaForDetails.engagementRate >= 10 ? '🔥 Viral / Top Performer' : '⭐ Rendimiento Estable'}
                    </span>
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed max-h-24 overflow-y-auto p-2.5 rounded-lg bg-black/40 border border-white/5 font-sans">
                    {selectedMediaForDetails.caption}
                  </p>
                </div>
              </div>

              {/* Métricas Cuantitativas */}
              <div>
                <h4 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2.5">Métricas de Interacción & Conversión</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[10px]">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex justify-between items-center text-white/40 mb-1">
                      <span>Likes</span>
                      <Heart size={12} className="text-red-400" />
                    </div>
                    <div className="text-lg font-black text-white">{selectedMediaForDetails.likeCount}</div>
                    <span className="text-[7.5px] text-white/30">Me gusta directos</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex justify-between items-center text-white/40 mb-1">
                      <span>Comentarios</span>
                      <MessageCircle size={12} className="text-blue-400" />
                    </div>
                    <div className="text-lg font-black text-white">{selectedMediaForDetails.commentsCount}</div>
                    <span className="text-[7.5px] text-white/30">Debates y respuestas</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#CCFF00]/5 border border-[#CCFF00]/20">
                    <div className="flex justify-between items-center text-[#CCFF00]/70 mb-1">
                      <span>Guardados</span>
                      <Bookmark size={12} className="text-[#CCFF00]" />
                    </div>
                    <div className="text-lg font-black text-[#CCFF00]">{selectedMediaForDetails.savedCount}</div>
                    <span className="text-[7.5px] text-[#CCFF00]/60">Save Ratio: {selectedMediaForDetails.likeCount > 0 ? ((selectedMediaForDetails.savedCount / selectedMediaForDetails.likeCount) * 100).toFixed(0) : 0}%</span>
                  </div>

                  <div className="p-3 rounded-xl bg-pink-500/5 border border-pink-500/20">
                    <div className="flex justify-between items-center text-pink-400/70 mb-1">
                      <span>Compartidos</span>
                      <Share2 size={12} className="text-pink-400" />
                    </div>
                    <div className="text-lg font-black text-pink-300">{selectedMediaForDetails.sharesCount}</div>
                    <span className="text-[7.5px] text-pink-400/60">Difusión orgánica</span>
                  </div>
                </div>
              </div>

              {/* Diagnóstico del Algoritmo de Meta 2026 */}
              <div className="p-4 rounded-xl bg-[#0F0F0F] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-[#CCFF00] flex items-center gap-1.5">
                    <Sparkles size={12} />
                    Diagnóstico del Algoritmo Meta 2026
                  </h4>
                  <span className="text-[8px] font-mono text-white/40">Análisis Predictivo</span>
                </div>

                <div className="space-y-2 text-[10px] text-white/70 leading-relaxed font-sans">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-start gap-2">
                    <span className="text-[#CCFF00] font-bold font-mono">1.</span>
                    <p>
                      <strong>Retención & Gancho Inicial:</strong> La estructura del copy activa el interés inmediato. Los posts con llamadas a la acción directas (como pedir una palabra clave en comentarios) multiplican por 3 la interacción del algoritmo de Meta.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-start gap-2">
                    <span className="text-[#CCFF00] font-bold font-mono">2.</span>
                    <p>
                      <strong>Save-to-Reach Ratio:</strong> Con un <strong>{selectedMediaForDetails.likeCount > 0 ? ((selectedMediaForDetails.savedCount / selectedMediaForDetails.likeCount) * 100).toFixed(0) : 0}%</strong> de guardados respecto a los likes, el contenido es clasificado por Meta como "Material de Consulta y Alto Valor", lo que amplía su vida útil en la pestaña Explorar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer de Acciones con IA */}
            <div className="p-4 border-t border-white/10 bg-black/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => {
                  const q = `@InstaAnalyst Realiza un desglose táctico de este Reel de @tsteam.fit: "${selectedMediaForDetails.caption.slice(0, 120)}...". Tuvo ${selectedMediaForDetails.likeCount} likes y ${selectedMediaForDetails.savedCount} guardados. Dime exactamente qué factores psicológicos y técnicos hicieron que la audiencia lo guardara y cómo optimizar la llamada a la acción para captar 5 nuevos clientes por DM.`;
                  setSelectedMediaForDetails(null);
                  onAskBot(q);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#CCFF00] text-black font-black text-[9.5px] uppercase tracking-wider hover:bg-white transition-all shadow-[0_0_15px_#CCFF0033] flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>Auditar a Fondo con @InstaAnalyst</span>
              </button>

              <button
                onClick={() => {
                  const q = `@InstaAnalyst A partir del éxito de este Reel de @tsteam.fit ("${selectedMediaForDetails.caption.slice(0, 80)}..."), escribe un GUION 2.0 (Secuela) para grabar esta semana con un gancho de 3 segundos más potente, estructura de 3 puntos clave y CTA para vender Asesorías Personalizadas de TJ FITLAB.`;
                  setSelectedMediaForDetails(null);
                  onAskBot(q);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-[9.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <FileText size={13} className="text-[#CCFF00]" />
                <span>Generar Guión 2.0 con IA</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

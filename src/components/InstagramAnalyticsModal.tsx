import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  TrendingUp, 
  Users, 
  Eye, 
  Bookmark, 
  Share2, 
  Heart, 
  MessageCircle, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  ExternalLink, 
  Sparkles, 
  X, 
  BarChart3, 
  Calendar, 
  Clock, 
  Zap,
  Globe
} from 'lucide-react';
import { 
  InstagramAnalyticsData, 
  getInstagramConfig, 
  saveInstagramConfig, 
  testInstagramConnection, 
  fetchInstagramMetrics 
} from '../lib/instagram';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAskBot: (question: string) => void;
}

export const InstagramAnalyticsModal: React.FC<Props> = ({ isOpen, onClose, onAskBot }) => {
  const [data, setData] = useState<InstagramAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getInstagramConfig();
      setTokenInput(config.accessToken);
      setAccountIdInput(config.accountId);
      loadMetrics();
    }
  }, [isOpen]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const res = await fetchInstagramMetrics();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const result = await testInstagramConnection(tokenInput, accountIdInput);
    setTestResult(result);
    setIsTesting(false);

    if (result.success) {
      saveInstagramConfig(tokenInput, accountIdInput);
      await loadMetrics();
      setTimeout(() => setShowConfig(false), 1500);
    }
  };

  if (!isOpen) return null;

  const ov = data?.overview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-[#090909] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[92vh]">
        
        {/* CABECERA MODAL */}
        <div className="h-16 border-b border-white/10 px-5 flex items-center justify-between bg-black/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Instagram size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs md:text-sm font-black uppercase tracking-wider text-white">Instagram Analytics & Growth Hub</h2>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${data?.isConnectedRealApi ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
                  {data?.isConnectedRealApi ? 'API En Vivo' : 'Modo Demo'}
                </span>
              </div>
              <p className="text-[9px] text-white/40 font-mono">Conexión con Meta Graph API & Análisis de @InstaAnalyst</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${showConfig ? 'bg-[#CCFF00] text-black border-[#CCFF00]' : 'bg-white/5 text-white/70 border-white/10 hover:text-white'}`}
            >
              <Key size={12} />
              <span className="hidden sm:inline">Configurar API</span>
            </button>
            <button 
              onClick={loadMetrics} 
              disabled={isLoading}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-[#CCFF00] hover:border-[#CCFF00]/40 transition-all disabled:opacity-40"
              title="Recargar métricas"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#CCFF00]' : ''} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
          
          {/* PANEL DESPLEGABLE DE CONFIGURACIÓN API META */}
          {showConfig && (
            <div className="p-5 rounded-xl bg-black/80 border border-indigo-500/30 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-[11px] uppercase tracking-wider">
                  <Key size={14} />
                  <span>Credenciales de Instagram Graph API (Meta for Developers)</span>
                </div>
                <a 
                  href="https://developers.facebook.com/tools/explorer/" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[9px] text-[#CCFF00] hover:underline flex items-center gap-1 font-mono"
                >
                  Meta Graph Explorer <ExternalLink size={10} />
                </a>
              </div>

              <form onSubmit={handleTestAndSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] text-white/40 font-bold uppercase tracking-widest block mb-1">
                    User / Page Access Token
                  </label>
                  <input 
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="EAABw..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 font-mono outline-none"
                  />
                  <span className="text-[8px] text-white/30 mt-1 block">Permisos requeridos: instagram_basic, instagram_manage_insights</span>
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
                  <span className="text-[8px] text-white/30 mt-1 block">Obtenible mediante /me/accounts en Meta Graph Explorer</span>
                </div>

                <div className="md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
                  {testResult && (
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                  {!testResult && <div className="text-[9px] text-white/40 font-mono">Guarda tus credenciales para conectar tus estadísticas reales.</div>}

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="submit"
                      disabled={isTesting}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                    >
                      <Zap size={12} />
                      <span>{isTesting ? 'Probando Conexión...' : 'Probar y Guardar Conexión'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* PERFIL & RESUMEN DE CUENTA */}
          {ov && (
            <div className="p-4 md:p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img 
                  src={ov.profilePictureUrl || '/logo-tjo.jpg'} 
                  alt="" 
                  className="w-14 h-14 rounded-2xl bg-black border-2 border-pink-500/40 object-cover shadow-[0_0_20px_rgba(221,42,123,0.3)]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">@{ov.username}</h3>
                    <span className="text-[9px] font-bold text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20 font-mono">
                      FITLAB OFICIAL
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 mt-0.5 font-medium">{ov.name}</p>
                  <p className="text-[9px] text-white/40 mt-1 font-mono flex items-center gap-3">
                    <span>👥 {ov.followersCount.toLocaleString()} Seguidores</span>
                    <span>•</span>
                    <span>🖼️ {ov.mediaCount} Publicaciones</span>
                  </p>
                </div>
              </div>

              {/* ACCIONES RÁPIDAS CON EL BOT */}
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button
                  onClick={() => {
                    onClose();
                    onAskBot("@InstaAnalyst Realiza una auditoría completa del rendimiento de nuestra cuenta de Instagram y dime qué 3 ajustes hacer hoy mismo.");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-pink-600/20"
                >
                  <Sparkles size={12} />
                  <span>Auditoría con @InstaAnalyst</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onAskBot("@InstaAnalyst Analiza mis publicaciones con mayor tasa de guardados y compartidos, y diséñame 3 ganchos (hooks) virales para los próximos Reels.");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <TrendingUp size={12} className="text-[#CCFF00]" />
                  <span>Ganchos Virales</span>
                </button>
              </div>
            </div>
          )}

          {/* TARJETAS DE MÉTRICAS CLAVE (KPIs) */}
          {ov && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              
              {/* Engagement Rate */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-[#CCFF00]/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Engagement Rate</span>
                  <div className="p-1.5 rounded-lg bg-[#CCFF00]/10 text-[#CCFF00]">
                    <TrendingUp size={14} />
                  </div>
                </div>
                <div className="text-xl md:text-2xl font-black text-[#CCFF00] font-mono">{ov.engagementRate}%</div>
                <div className="text-[9px] text-green-400 mt-1 flex items-center gap-1 font-mono">
                  <span>+2.4x</span>
                  <span className="text-white/40">vs promedio sector (1.9%)</span>
                </div>
              </div>

              {/* Alcance 28 Días */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-pink-500/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Alcance (Reach 28d)</span>
                  <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
                    <Users size={14} />
                  </div>
                </div>
                <div className="text-xl md:text-2xl font-black text-white font-mono">{ov.weeklyReach.toLocaleString()}</div>
                <div className="text-[9px] text-pink-400 mt-1 flex items-center gap-1 font-mono">
                  <span>{ov.weeklyImpressions.toLocaleString()}</span>
                  <span className="text-white/40">impresiones totales</span>
                </div>
              </div>

              {/* Visitas al Perfil */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Visitas al Perfil</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Eye size={14} />
                  </div>
                </div>
                <div className="text-xl md:text-2xl font-black text-white font-mono">{ov.profileViews.toLocaleString()}</div>
                <div className="text-[9px] text-indigo-300 mt-1 flex items-center gap-1 font-mono">
                  <span>{ov.websiteClicks.toLocaleString()} clics</span>
                  <span className="text-white/40">a la App de FITLAB</span>
                </div>
              </div>

              {/* Horario Óptimo */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Horario de Mayor Pico</span>
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Clock size={14} />
                  </div>
                </div>
                <div className="text-sm md:text-base font-black text-cyan-300 font-mono mt-1">19:30 - 21:00 CET</div>
                <div className="text-[9px] text-white/40 mt-1 font-mono">Lunes a Jueves (Mejor retención)</div>
              </div>

            </div>
          )}

          {/* TOP PUBLICACIONES & REELS ANALIZADOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-[#CCFF00]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Rendimiento por Publicación / Reel</h4>
              </div>
              <span className="text-[9px] text-white/40 font-mono">Ordenado por Interacción & Guardados</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {data?.recentMedia.map((m) => (
                <div 
                  key={m.id} 
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex gap-3.5 group"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/60 flex-shrink-0 relative border border-white/10">
                    <img 
                      src={m.mediaUrl} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[7px] font-black text-[#CCFF00] uppercase font-mono">
                      {m.mediaType === 'VIDEO' ? 'REEL' : m.mediaType === 'CAROUSEL_ALBUM' ? 'CARRUSEL' : 'POST'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-white/80 line-clamp-2 leading-relaxed">
                        {m.caption}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/5 text-[9px] font-mono text-white/60">
                      <div className="flex items-center gap-1">
                        <Heart size={10} className="text-red-400" />
                        <span>{m.likeCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle size={10} className="text-blue-400" />
                        <span>{m.commentsCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bookmark size={10} className="text-[#CCFF00]" />
                        <span className="font-bold text-white">{m.savedCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Share2 size={10} className="text-pink-400" />
                        <span className="font-bold text-white">{m.sharesCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* INSIGHTS DE AUDIENCIA & ESTRATEGIA */}
          {ov && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#CCFF00]/5 via-purple-500/5 to-pink-500/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-[#CCFF00] flex items-center gap-1.5">
                  <Zap size={12} />
                  Diagnóstico Rápido del Algoritmo (Meta 2026)
                </h5>
                <p className="text-[10px] text-white/70">
                  El ratio de <strong>Guardados + Compartidos</strong> en tu contenido sobre <em>"Ozempic & Fuerza"</em> y <em>"Errores RIR"</em> supera el <strong>8.2%</strong>, activando la distribución masiva en la pestaña Explorar de Instagram.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onAskBot("@InstaAnalyst Dame un desglose de los 5 tipos de contenido en fitness con mayor retención para convertir seguidores en clientes activos de TJ FITLAB.");
                }}
                className="flex-shrink-0 px-3 py-2 rounded-lg bg-[#CCFF00] text-black font-black text-[9px] uppercase tracking-wider hover:bg-white transition-all shadow-[0_0_12px_#CCFF0033]"
              >
                Ver Estrategia Completa
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

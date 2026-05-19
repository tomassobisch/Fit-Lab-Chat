export interface Agente {
  id: string;
  nombre: string;
  nickname: string;
  rol: string;
  skills: string;
  avatar_url: string;
  estado_online: boolean;
  creado_en: string;
}

export interface Mensaje {
  id: string;
  canal: string;
  remitente_tipo: 'usuario' | 'agente';
  remitente_id: string;
  texto: string;
  estado_procesado: boolean;
  creado_en: string;
  // Extra field for UI join
  agente?: Agente;
}

export interface ReporteGym {
  id: string;
  total_alumnos: number;
  mensajes_pendientes: number;
  pendientes_escaneo: string[];
  sin_respuesta: string[];
  creado_en: string;
}

export type Canal = '#general' | '#desarrollo' | '#marketing';

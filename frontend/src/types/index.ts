export interface Empresa {
  id: number;
  nombre: string;
  email: string;
  porcentaje_tecnico: number;
  umbral_visita_bajo: number;
  umbral_visita_alto: number;
}

export interface Ciudad {
  id: number;
  nombre: string;
  empresa_id: number;
  activa: boolean;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'agente_sc' | 'tecnico' | 'superadmin';
  empresa_id: number;
  activo: boolean;
}

export interface Cliente {
  id: string;
  nombre_completo?: string;
  telefono_1?: string;
  telefono_2?: string;
  email?: string;
  whatsapp?: string;
  cc_nit?: string;
  requiere_factura: boolean;
  direccion?: string;
  barrio?: string;
  ciudad_id?: string;
  ciudad?: Ciudad;
  empresa_id: string;
}

export interface Tecnico {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  tipo_pago: 'porcentaje' | 'nomina';
  porcentaje_override?: number;
  recibe_total: boolean;
  salario_mensual?: number;
  periodo_pago?: 'mensual' | 'quincenal';
  saldo_deuda: number;
  activo: boolean;
  empresa_id: number;
}

export interface AgenteSC {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  porcentaje: number;
  activo: boolean;
  empresa_id: number;
}

export interface TipoServicio {
  id: number;
  nombre: string;
  categoria: string;
  genera_garantia: boolean;
  porcentaje_tecnico?: number;
  activo: boolean;
  empresa_id: number;
}

export interface Servicio {
  id: number;
  empresa_id: number;
  tecnico_id: number;
  tipo_servicio_id: number;
  ciudad_id: number;
  cliente_id?: number;
  estado: 'en_cotizacion' | 'pendiente' | 'en_progreso' | 'completado' | 'cerrado' | 'cancelado' | 'convertida';
  es_visita: boolean;
  es_garantia: boolean;
  direccion?: string;
  fecha: string;
  fecha_completado?: string;
  valor?: number;
  medio_pago?: string;
  efectivo_entregado: boolean;
  empresa_debe_tecnico: boolean;
  tiene_materiales: boolean;
  costo_materiales: number;
  tiene_herramienta: boolean;
  costo_herramienta: number;
  cliente_anonimo: boolean;
  nombre_cliente_anon?: string;
  telefono_cliente_anon?: string;
  observaciones?: string;
  cliente?: Cliente;
  motivo_pendiente?: string;
  origen?: string;
  servicio_padre_id?: number;
  tecnico?: Tecnico;
  tipo_servicio?: TipoServicio;
  ciudad?: Ciudad;
  pago_tecnico?: PagoTecnico;
  garantia?: Garantia;
  deuda?: DeudaTecnico;
}

export interface PagoTecnico {
  id: number;
  servicio_id: number;
  tecnico_id: number;
  valor_bruto: number;
  costo_materiales: number;
  costo_herramienta: number;
  valor_neto: number;
  porcentaje_tecnico: number;
  monto_tecnico: number;
  monto_empresa: number;
  medio_pago_cliente?: string;
  estado_entrega: 'pendiente' | 'entregado';
  fecha_entrega?: string;
  fecha_registro: string;
  tecnico?: Tecnico;
  servicio?: Servicio;
}

export interface DeudaTecnico {
  id: number;
  tecnico_id: number;
  servicio_id: number;
  monto_cobrado: number;
  monto_entregado: number;
  monto_pendiente: number;
  estado: 'pendiente' | 'abonada' | 'saldada';
  tecnico?: Tecnico;
  servicio?: Servicio;
}

export interface Garantia {
  id: number;
  servicio_id: number;
  tecnico_id: number;
  estado: 'activa' | 'vencida' | 'reclamada' | 'resuelta' | 'cancelada';
  fecha_inicio: string;
  fecha_vence: string;
  dias_restantes?: number;
  alerta?: boolean;
  descripcion_problema?: string;
  fecha_atencion?: string;
  tipo_resolucion?: string;
  resolucion?: string;
  tecnico?: Tecnico;
  servicio?: Servicio;
}

export interface PagoAgente {
  id: number;
  agente_id: number;
  monto_total: number;
  estado: 'pendiente' | 'pagado';
  referencia?: string;
  fecha_desde: string;
  fecha_hasta: string;
  fecha_registro: string;
  fecha_pago?: string;
  agente?: AgenteSC;
}

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  empresa_id: number;
}

export interface Gasto {
  id: string;
  empresa_id: string;
  concepto: string;
  monto: number;
  fecha: string;
  categoria: 'publicidad' | 'sc' | 'arriendo' | 'nomina_interna' | 'otro';
  notas?: string;
}

export interface DocumentoTecnico {
  id: string;
  tecnico_id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_vence: string;
  notas?: string;
  activo: boolean;
}

export interface ApiError {
  error: string;
}

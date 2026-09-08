/**
 * Display labels for backend codes.
 *
 * The API speaks codes (`approved`, `orders`, ...); the UI speaks Spanish.
 * Keeping the mapping here makes the app translatable in one place.
 */

export const ORDER_STATUS_LABELS = {
  approved: 'Aprobada',
  pending: 'Pendiente',
  rejected: 'Rechazada',
  refunded: 'Reembolsada',
};

/** Badge tone per status, consumed by the Badge component. */
export const ORDER_STATUS_TONE = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  refunded: 'neutral',
};

export const IMPORT_KIND_LABELS = {
  orders: 'órdenes',
  expenses: 'gastos',
};

export const statusLabel = (code) => ORDER_STATUS_LABELS[code] || code;
export const statusTone = (code) => ORDER_STATUS_TONE[code] || 'neutral';

/** Navigation entries; `id` matches the router route. `logo` renders the brand mark. */
export const NAV_ITEMS = [
  { id: 'agent', label: 'Agente', icon: 'logo' },
  { id: 'orders', label: 'Órdenes', icon: '⇄' },
  { id: 'expenses', label: 'Gastos', icon: '▤' },
  { id: 'reports', label: 'Análisis', icon: '◔' },
  { id: 'library', label: 'Reportes', icon: '▦' },
  // Only shown to administrators (see Sidebar).
  { id: 'users', label: 'Usuarios', icon: '◍', adminOnly: true },
];

/** Starter prompts shown as cards on the empty chat screen. */
export const CHAT_SUGGESTIONS = [
  { icon: '◔', text: '¿Cómo cerró el mes?' },
  { icon: '＋', text: 'Registra un gasto' },
  { icon: '⚠', text: '¿Hay alertas o anomalías?' },
  { icon: '▤', text: 'Genera el reporte financiero en PDF' },
];

/** Human label of each screen, shown in the dock so the context is explicit. */
export const VIEW_LABELS = {
  agent: 'Agente',
  orders: 'Órdenes',
  expenses: 'Gastos',
  reports: 'Análisis',
  library: 'Reportes',
  users: 'Usuarios',
  settings: 'Configuración',
};

/**
 * Quick prompts offered by the floating dock, tailored to the screen the user
 * is on — the agent already receives that screen as context.
 */
export const VIEW_SUGGESTIONS = {
  orders: ['¿Cuántas órdenes rechazadas hay?', 'Registra una orden'],
  expenses: ['¿Qué gastos no tienen comprobante?', 'Registra un gasto'],
  reports: ['¿Hay alertas o anomalías?', 'Genera el reporte financiero en PDF'],
  library: ['¿Qué reportes tengo guardados?', 'Grafica los ingresos por semana'],
  users: ['¿Cómo cerró el mes?', '¿Hay alertas o anomalías?'],
  agent: ['¿Cómo cerró el mes?', '¿Hay alertas o anomalías?'],
};

/**
 * Cargos de las cuentas.
 *
 * El rol dice qué hace la persona en la empresa, no qué puede hacer en el
 * panel: todos trabajan con las mismas pantallas. El único con autoridad es
 * `admin`, que además gestiona quién entra (altas, roles y sesiones).
 *
 * Los códigos viven en el backend (`models.ROLES`); acá solo se les pone
 * nombre, como con los estados de las órdenes.
 */
export const ROLE_GROUPS = [
  {
    label: 'Acceso',
    roles: [
      ['admin', 'Administrador'],
      ['miembro', 'Miembro'],
    ],
  },
  {
    label: 'Dirección y equipo',
    roles: [
      ['ceo', 'CEO'],
      ['cofundador', 'Cofundador'],
      ['coo', 'COO'],
      ['cto', 'CTO'],
      ['cpo', 'CPO'],
      ['cmo', 'CMO'],
      ['cro', 'CRO'],
      ['product_manager', 'Product Manager'],
      ['growth', 'Growth'],
      ['ingenieria', 'Ingeniería'],
      ['diseno', 'Diseño'],
      ['datos', 'Data'],
      ['ventas', 'Ventas'],
      ['marketing', 'Marketing'],
      ['soporte', 'Soporte'],
      ['customer_success', 'Customer Success'],
      ['people', 'People'],
      ['legal', 'Legal'],
      ['operaciones', 'Operaciones'],
      ['compras', 'Compras'],
    ],
  },
  {
    label: 'Finanzas',
    roles: [
      ['cfo', 'CFO'],
      ['controller', 'Controller'],
      ['contabilidad', 'Contabilidad'],
      ['tesoreria', 'Tesorería'],
      ['cuentas_por_pagar', 'Cuentas por pagar'],
      ['cuentas_por_cobrar', 'Cuentas por cobrar'],
      ['facturacion', 'Facturación'],
      ['cobranza', 'Cobranza'],
      ['nomina', 'Nómina'],
      ['analista_financiero', 'Analista fin.'],
      ['fpa', 'FP&A'],
      ['presupuesto', 'Presupuesto'],
      ['auditoria_interna', 'Auditoría'],
      ['compliance', 'Cumplimiento'],
      ['riesgos', 'Riesgos'],
      ['impuestos', 'Impuestos'],
      ['inversionista', 'Inversionista'],
    ],
  },
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_GROUPS.flatMap((group) => group.roles),
);

/** Nombre visible de un cargo; si es desconocido se muestra su código. */
export function roleLabel(code) {
  return ROLE_LABELS[code] || code || '—';
}

/** Opciones agrupadas para un <select>, en el orden de ROLE_GROUPS. */
export function roleOptions() {
  return ROLE_GROUPS.map((group) => ({
    label: group.label,
    items: group.roles.map(([value, label]) => ({ value, label })),
  }));
}

export const dashboardStats = {
  totalClients: 5,
  activeClients: 4,
  pausedClients: 1,
  pendingCheckins: 2,
  checkinsThisWeek: 4,
  lowAdherenceClients: 1,
  plansToReview: 2,
  weeklyRevenue: null,
}

export const upcomingTasks = [
  { id: 1, type: 'review', client: 'Valentina Morales', clientId: '1', task: 'Ajustar calorías -50 kcal', dueDate: '2025-05-26', priority: 'high' },
  { id: 2, type: 'checkin', client: 'Matías Fernández', clientId: '2', task: 'Check-in semanal pendiente', dueDate: '2025-05-25', priority: 'high' },
  { id: 3, type: 'plan', client: 'Gonzalo Suárez', clientId: '4', task: 'Revisar progresión de cargas', dueDate: '2025-05-27', priority: 'medium' },
  { id: 4, type: 'review', client: 'Camila Ríos', clientId: '5', task: 'Planificación competencia junio', dueDate: '2025-05-28', priority: 'medium' },
  { id: 5, type: 'contact', client: 'Lucía Ramírez', clientId: '3', task: 'Confirmar fecha de retorno', dueDate: '2025-06-01', priority: 'low' },
]

export const weekSummary = {
  checkinsCompleted: 4,
  adjustmentsMade: 2,
  newClients: 0,
  avgAdherenceNutrition: 82,
  avgAdherenceTraining: 90,
  bestClient: 'Camila Ríos',
  needsAttention: 'Lucía Ramírez',
}

export const recentActivity = [
  { id: 1, type: 'checkin', client: 'Camila Ríos', clientId: '5', text: 'Completó check-in semana 15', time: 'Hace 2 horas' },
  { id: 2, type: 'checkin', client: 'Gonzalo Suárez', clientId: '4', text: 'Completó check-in semana 15', time: 'Hace 5 horas' },
  { id: 3, type: 'adjust', client: 'Valentina Morales', clientId: '1', text: 'Plan nutricional ajustado', time: 'Ayer' },
  { id: 4, type: 'checkin', client: 'Matías Fernández', clientId: '2', text: 'Completó check-in semana 15', time: 'Ayer' },
  { id: 5, type: 'plan', client: 'Gonzalo Suárez', clientId: '4', text: 'Rutina actualizada — fase definición', time: 'Hace 3 días' },
]

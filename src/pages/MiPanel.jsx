import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Utensils, Dumbbell, ClipboardCheck, TrendingUp, ArrowRight,
  CheckCircle2, Clock, AlertCircle, MessageSquare, Calendar, Zap, ChevronRight
} from 'lucide-react'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { mockCheckins } from '../data/mockCheckins'
import { getMyClientProfile } from '../services/clientService'

function CoachNote({ text }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-accent/5 border border-accent/15 rounded-xl">
      <div className="w-7 h-7 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
        <Zap size={13} className="text-accent" />
      </div>
      <div>
        <div className="text-accent text-xs font-semibold mb-1">Tu coach dice:</div>
        <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

function QuickStat({ label, value, color = 'text-white', bg = 'bg-white/[0.03]' }) {
  return (
    <div className={`${bg} rounded-xl p-3.5 flex flex-col gap-1`}>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className={`font-bold text-lg leading-tight ${color}`}>{value}</div>
    </div>
  )
}

export default function MiPanel() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyClientProfile()
      .then(({ data }) => setClient(data ?? null))
      .catch(() => setClient(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <header className="sticky top-0 z-40 flex items-center gap-2.5 px-5 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Mi seguimiento</span>
        </header>
        <PageLoader label="Cargando tu panel..." />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <header className="sticky top-0 z-40 flex items-center gap-2.5 px-5 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Mi seguimiento</span>
        </header>
        <EmptyState
          icon={Zap}
          title="Tu perfil no está configurado"
          description="Pedile a tu coach que active tu cuenta."
        />
      </div>
    )
  }

  const lastCheckin = mockCheckins.find((c) => c.clientId === client.id)
  const nextCheckinDate = client.nextReview ? new Date(client.nextReview) : null
  const daysUntilCheckin = nextCheckinDate
    ? Math.ceil((nextCheckinDate - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Mi seguimiento</span>
        </div>
        <button
          className="text-slate-500 hover:text-white text-xs transition-colors"
          onClick={() => navigate('/dashboard')}
        >
          Vista coach →
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              Hola, {client.name.split(' ')[0]} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Semana {lastCheckin?.week || 15} · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0"
            style={{ backgroundColor: client.avatarColor + '22', color: client.avatarColor }}
          >
            {client.avatar}
          </div>
        </div>

        {/* Status overview */}
        <div className="grid grid-cols-2 gap-3">
          {client.weight && (
            <QuickStat label="Peso actual" value={`${client.weight} kg`} color="text-white" />
          )}
          {client.targetWeight && (
            <QuickStat label="Objetivo" value={`${client.targetWeight} kg`} color="text-accent" />
          )}
          <QuickStat
            label="Adherencia nutricional"
            value={`${client.adherenceNutrition}%`}
            color={client.adherenceNutrition >= 85 ? 'text-emerald-400' : 'text-amber-400'}
          />
          <QuickStat
            label="Adherencia entrenamiento"
            value={`${client.adherenceTraining}%`}
            color={client.adherenceTraining >= 85 ? 'text-emerald-400' : 'text-amber-400'}
          />
        </div>

        {/* Coach note */}
        {lastCheckin?.coachFeedback && (
          <CoachNote text={lastCheckin.coachFeedback} />
        )}

        {/* Check-in status */}
        {daysUntilCheckin !== null && (
          <div className={`flex items-center gap-4 p-4 rounded-2xl border ${
            daysUntilCheckin <= 2
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-emerald-500/5 border-emerald-500/15'
          }`}>
            {daysUntilCheckin <= 2 ? (
              <Clock size={22} className="text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${daysUntilCheckin <= 2 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {daysUntilCheckin <= 0
                  ? 'Tu check-in está pendiente hoy'
                  : daysUntilCheckin === 1
                    ? 'Tu check-in es mañana'
                    : `Próximo check-in en ${daysUntilCheckin} días`}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                {new Date(client.nextReview).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            <Button
              size="sm"
              variant={daysUntilCheckin <= 2 ? 'primary' : 'secondary'}
              iconRight={ArrowRight}
            >
              Cargar
            </Button>
          </div>
        )}

        {/* Mi nutrición */}
        {client.nutrition && (
          <SectionCard
            title="Mi plan nutricional"
            subtitle={client.nutrition.lastUpdate
              ? `Actualizado ${new Date(client.nutrition.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`
              : undefined
            }
            action={
              <button
                className="flex items-center gap-1 text-accent text-xs font-medium hover:underline"
                onClick={() => navigate('/nutrition')}
              >
                Ver completo <ChevronRight size={13} />
              </button>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Calories */}
              <div className="flex items-center justify-between p-4 bg-accent/5 rounded-xl border border-accent/10">
                <div className="flex items-center gap-3">
                  <Utensils size={20} className="text-accent" />
                  <div>
                    <div className="text-white font-bold text-xl">{client.nutrition.calories}</div>
                    <div className="text-slate-500 text-xs">kcal objetivo hoy</div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>P: <span className="text-white font-semibold">{client.nutrition.protein}g</span></div>
                  <div>C: <span className="text-white font-semibold">{client.nutrition.carbs}g</span></div>
                  <div>G: <span className="text-white font-semibold">{client.nutrition.fat}g</span></div>
                </div>
              </div>

              {/* Today's meals */}
              {client.nutrition.meals?.length > 0 && (
                <div>
                  <div className="text-slate-500 text-xs font-medium mb-2.5">Comidas del día</div>
                  <div className="flex flex-col gap-2">
                    {client.nutrition.meals.slice(0, 4).map((meal, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-white/[0.04] last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">{meal.name}</div>
                          <div className="text-slate-500 text-xs truncate">{meal.description}</div>
                        </div>
                        <div className="text-accent text-sm font-semibold shrink-0">{meal.calories} kcal</div>
                      </div>
                    ))}
                    {client.nutrition.meals.length > 4 && (
                      <div className="text-slate-600 text-xs text-center py-1">
                        +{client.nutrition.meals.length - 4} comidas más — ver plan completo
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Mi rutina */}
        {client.training && (
          <SectionCard
            title="Mi rutina de entrenamiento"
            subtitle={client.training.plan}
            action={
              <button
                className="flex items-center gap-1 text-accent text-xs font-medium hover:underline"
                onClick={() => navigate('/training')}
              >
                Ver completa <ChevronRight size={13} />
              </button>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Days */}
              {client.training.days?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => {
                    const dayMap = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
                    const active = client.training.days.includes(dayMap[i])
                    return (
                      <div
                        key={d}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                          active ? 'bg-accent text-white' : 'bg-white/[0.04] text-slate-600'
                        }`}
                      >
                        {d}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Exercises preview */}
              {client.training.exercises?.length > 0 && (
                <div>
                  <div className="text-slate-500 text-xs font-medium mb-2.5">Ejercicios principales</div>
                  <div className="flex flex-col gap-2">
                    {client.training.exercises.slice(0, 4).map((ex, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-white/[0.04] last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500 text-[10px] font-semibold shrink-0">
                            {i + 1}
                          </div>
                          <div>
                            <div className="text-white text-sm">{ex.name}</div>
                            {ex.notes && <div className="text-slate-600 text-xs">{ex.notes}</div>}
                          </div>
                        </div>
                        <div className="flex gap-3 shrink-0 text-right">
                          {ex.sets > 0 && <span className="text-slate-400 text-xs">{ex.sets}×{ex.reps}</span>}
                          {ex.load && <span className="text-accent text-xs font-semibold">{ex.load}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Mi progreso */}
        {client.progress && (
          <SectionCard
            title="Mi progreso"
            subtitle="Evolución de peso"
            action={
              <button
                className="flex items-center gap-1 text-accent text-xs font-medium hover:underline"
                onClick={() => navigate('/progress')}
              >
                Ver detalle <ChevronRight size={13} />
              </button>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Mini chart */}
              {client.progress.weightHistory?.length > 0 && (
                <div className="flex items-end gap-1.5 h-20">
                  {client.progress.weightHistory.map((w, i) => {
                    const max = Math.max(...client.progress.weightHistory)
                    const min = Math.min(...client.progress.weightHistory) - 0.5
                    const range = max - min || 1
                    const heightPct = ((w - min) / range) * 70 + 20
                    const isLast = i === client.progress.weightHistory.length - 1
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        {isLast && <span className="text-emerald-400 text-[9px] font-bold">{w}</span>}
                        <div
                          className={`w-full rounded-t-md ${isLast ? 'bg-accent' : 'bg-accent/30'}`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-slate-600 text-[9px]">{client.progress.dates?.[i]}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Stats */}
              {client.progress.weightHistory?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                    <div className="text-slate-500 text-xs mb-0.5">Inicio</div>
                    <div className="text-white font-bold">{client.progress.weightHistory[0]} kg</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                    <div className="text-slate-500 text-xs mb-0.5">Actual</div>
                    <div className="text-emerald-400 font-bold">{client.weight} kg</div>
                  </div>
                  <div className="bg-accent/10 rounded-xl p-3 text-center">
                    <div className="text-slate-500 text-xs mb-0.5">Objetivo</div>
                    <div className="text-accent font-bold">{client.targetWeight} kg</div>
                  </div>
                </div>
              )}

              {/* Adherence */}
              <div className="flex flex-col gap-3">
                <ProgressBar label="Nutrición esta semana" value={client.adherenceNutrition} color="accent" />
                <ProgressBar label="Entrenamiento esta semana" value={client.adherenceTraining} color="emerald" />
              </div>
            </div>
          </SectionCard>
        )}

        {/* Último check-in */}
        {lastCheckin && (
          <SectionCard
            title="Mi último check-in"
            subtitle={`Semana ${lastCheckin.week} · ${new Date(lastCheckin.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}
            action={
              <Badge variant={lastCheckin.decision} />
            }
          >
            <div className="flex flex-col gap-4">
              {/* Micros */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Energía', value: lastCheckin.energy },
                  { label: 'Sueño', value: lastCheckin.sleep },
                  { label: 'Estrés', value: lastCheckin.stress },
                  { label: 'Hambre', value: lastCheckin.hunger },
                ].map((m) => (
                  <div key={m.label} className="bg-white/[0.02] rounded-xl p-2.5 text-center">
                    <div className="text-slate-600 text-[10px] mb-1">{m.label}</div>
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${i <= m.value ? 'bg-accent' : 'bg-white/10'}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Feedback */}
              {lastCheckin.coachFeedback && (
                <div className="p-3.5 bg-accent/5 border border-accent/10 rounded-xl">
                  <div className="flex items-center gap-1.5 text-accent text-xs font-semibold mb-2">
                    <MessageSquare size={12} /> Feedback de tu coach
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{lastCheckin.coachFeedback}</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Indicaciones */}
        {(client.weeklyGoal || client.limitations || client.internalNotes) && (
          <SectionCard title="Indicaciones del coach" subtitle="Últimas notas para esta semana">
            <div className="flex flex-col gap-3">
              {client.weeklyGoal && (
                <div className="flex items-start gap-3 p-3.5 bg-white/[0.02] rounded-xl">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white text-sm font-medium">{client.weeklyGoal}</div>
                    <div className="text-slate-500 text-xs mt-0.5">Objetivo de la semana</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3.5 bg-white/[0.02] rounded-xl">
                <Dumbbell size={16} className="text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="text-white text-sm font-medium">Revisá las observaciones técnicas antes de entrenar</div>
                  <div className="text-slate-500 text-xs mt-0.5">Ver en Rutina completa</div>
                </div>
              </div>
              {client.limitations && (
                <div className="flex items-start gap-3 p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-amber-300 text-xs font-semibold mb-0.5">Tener en cuenta</div>
                    <div className="text-slate-300 text-sm">{client.limitations}</div>
                  </div>
                </div>
              )}
              {client.internalNotes && (
                <div className="p-3.5 bg-white/[0.02] rounded-xl">
                  <div className="text-slate-500 text-xs mb-1">Notas internas</div>
                  <p className="text-slate-300 text-sm leading-relaxed">{client.internalNotes}</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Quick navigation */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/nutrition')}
            className="flex items-center gap-3 p-4 bg-[#111118] border border-white/[0.06] rounded-2xl hover:border-accent/25 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Utensils size={18} className="text-accent" />
            </div>
            <div>
              <div className="text-white text-sm font-medium">Mi nutrición</div>
              <div className="text-slate-500 text-xs">Plan completo</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/training')}
            className="flex items-center gap-3 p-4 bg-[#111118] border border-white/[0.06] rounded-2xl hover:border-accent/25 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Dumbbell size={18} className="text-accent" />
            </div>
            <div>
              <div className="text-white text-sm font-medium">Mi rutina</div>
              <div className="text-slate-500 text-xs">Ejercicios y cargas</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/checkins')}
            className="flex items-center gap-3 p-4 bg-[#111118] border border-white/[0.06] rounded-2xl hover:border-accent/25 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <ClipboardCheck size={18} className="text-accent" />
            </div>
            <div>
              <div className="text-white text-sm font-medium">Check-ins</div>
              <div className="text-slate-500 text-xs">Historial semanal</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/progress')}
            className="flex items-center gap-3 p-4 bg-[#111118] border border-white/[0.06] rounded-2xl hover:border-accent/25 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <TrendingUp size={18} className="text-accent" />
            </div>
            <div>
              <div className="text-white text-sm font-medium">Mi progreso</div>
              <div className="text-slate-500 text-xs">Peso y medidas</div>
            </div>
          </button>
        </div>

      </div>
    </div>
  )
}

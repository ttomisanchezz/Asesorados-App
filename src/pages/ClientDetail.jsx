import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Target, Dumbbell, Utensils, TrendingUp,
  ClipboardCheck, Phone, Mail, AlertCircle, Calendar, Edit2
} from 'lucide-react'
import Layout from '../components/layout/Layout'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'
import { getClientById } from '../data/mockClients'

const TABS = [
  { id: 'summary', label: 'Resumen', icon: User },
  { id: 'nutrition', label: 'Nutrición', icon: Utensils },
  { id: 'training', label: 'Entrenamiento', icon: Dumbbell },
  { id: 'checkins', label: 'Check-ins', icon: ClipboardCheck },
  { id: 'progress', label: 'Progreso', icon: TrendingUp },
]

function RatingDots({ value, max = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < value ? 'bg-accent' : 'bg-white/10'}`}
        />
      ))}
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = getClientById(id)
  const [activeTab, setActiveTab] = useState('summary')

  if (!client) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle size={40} className="text-slate-500" />
          <p className="text-slate-400">Asesorado no encontrado.</p>
          <Button onClick={() => navigate('/clients')} icon={ArrowLeft}>
            Volver
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Back */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-5 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a asesorados
      </button>

      {/* Hero card */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ backgroundColor: client.avatarColor + '22', color: client.avatarColor }}
          >
            {client.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{client.name}</h1>
              <Badge variant={client.status} />
            </div>
            <p className="text-slate-400 text-sm">{client.objective} · {client.age} años · {client.experience}</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Mail size={12} /> {client.email}
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Phone size={12} /> {client.phone}
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Calendar size={12} /> Desde {new Date(client.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={Edit2}>
            Editar
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/[0.05]">
          <div>
            <div className="text-slate-500 text-xs mb-1">Peso actual</div>
            <div className="text-white font-bold text-lg">{client.weight} kg</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Objetivo</div>
            <div className="text-white font-bold text-lg">{client.targetWeight} kg</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Adherencia nut.</div>
            <div className="text-emerald-400 font-bold text-lg">{client.adherenceNutrition}%</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Adherencia ent.</div>
            <div className="text-emerald-400 font-bold text-lg">{client.adherenceTraining}%</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === id
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <SectionCard title="Datos personales">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Altura', `${client.height} cm`],
                ['Peso', `${client.weight} kg`],
                ['Objetivo de peso', `${client.targetWeight} kg`],
                ['Experiencia', client.experience],
                ['Días disponibles', client.availableDays.length],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-slate-500 text-xs mb-0.5">{label}</div>
                  <div className="text-white text-sm font-medium">{val}</div>
                </div>
              ))}
            </div>
            {client.limitations && (
              <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
                  <AlertCircle size={13} /> Limitaciones
                </div>
                <p className="text-slate-300 text-sm">{client.limitations}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Días disponibles">
            <div className="flex flex-wrap gap-2">
              {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((day) => (
                <span
                  key={day}
                  className={`px-3 py-1.5 rounded-xl text-sm ${
                    client.availableDays.includes(day)
                      ? 'bg-accent/15 text-accent border border-accent/25'
                      : 'bg-white/[0.03] text-slate-600 border border-white/[0.04]'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Adherencia semanal">
            <div className="flex flex-col gap-4">
              <ProgressBar label="Nutrición" value={client.adherenceNutrition} color="accent" />
              <ProgressBar label="Entrenamiento" value={client.adherenceTraining} color="emerald" />
            </div>
          </SectionCard>

          <SectionCard title="Notas internas">
            <p className="text-slate-300 text-sm leading-relaxed">{client.internalNotes}</p>
            <div className="mt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Último check-in</span>
                <span className="text-white">{new Date(client.lastCheckin).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Próxima revisión</span>
                <span className="text-white">{new Date(client.nextReview).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Objetivo semanal</span>
                <span className="text-accent">{client.weeklyGoal}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'nutrition' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard title="Objetivo calórico" className="lg:col-span-1">
            <div className="text-center py-2">
              <div className="text-4xl font-bold text-white mb-1">{client.nutrition.calories}</div>
              <div className="text-slate-500 text-sm">kcal / día</div>
            </div>
            <div className="flex flex-col gap-3 mt-4">
              <ProgressBar label={`Proteína ${client.nutrition.protein}g`} value={client.nutrition.protein} max={250} color="accent" />
              <ProgressBar label={`Carbohidratos ${client.nutrition.carbs}g`} value={client.nutrition.carbs} max={400} color="sky" />
              <ProgressBar label={`Grasas ${client.nutrition.fat}g`} value={client.nutrition.fat} max={120} color="amber" />
            </div>
            <div className="mt-4 text-xs text-slate-500 text-center">
              Última actualización: {new Date(client.nutrition.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
            </div>
          </SectionCard>

          <SectionCard title="Plan de comidas" className="lg:col-span-2">
            <div className="flex flex-col gap-3">
              {client.nutrition.meals.map((meal, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{meal.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{meal.description}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-accent font-semibold text-sm">{meal.calories}</div>
                    <div className="text-slate-600 text-xs">kcal</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-slate-500 text-sm">Total</span>
              <span className="text-white font-bold text-sm">
                {client.nutrition.meals.reduce((sum, m) => sum + m.calories, 0)} kcal
              </span>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'training' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard title="Plan activo" className="lg:col-span-1">
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl mb-4">
              <div className="text-accent font-semibold text-sm">{client.training.plan}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-2">Días de entrenamiento</div>
              <div className="flex flex-wrap gap-1.5">
                {client.training.days.map((day) => (
                  <span key={day} className="px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-lg border border-accent/20">
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Ejercicios" className="lg:col-span-2">
            <div className="flex flex-col gap-2">
              {client.training.exercises.map((ex, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{ex.name}</div>
                    {ex.notes && <div className="text-slate-500 text-xs mt-0.5">{ex.notes}</div>}
                  </div>
                  <div className="flex gap-3 shrink-0">
                    {ex.sets > 0 && (
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">{ex.sets}</div>
                        <div className="text-slate-600 text-xs">series</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-white font-semibold text-sm">{ex.reps}</div>
                      <div className="text-slate-600 text-xs">reps</div>
                    </div>
                    {ex.load && (
                      <div className="text-center">
                        <div className="text-accent font-semibold text-sm">{ex.load}</div>
                        <div className="text-slate-600 text-xs">carga</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'checkins' && (
        <div className="flex flex-col gap-4">
          <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6 text-center">
            <ClipboardCheck size={32} className="text-slate-500 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Check-ins del asesorado</p>
            <p className="text-slate-500 text-sm mb-4">
              Último check-in: {new Date(client.lastCheckin).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <Button icon={ClipboardCheck}>Cargar nuevo check-in</Button>
          </div>
          <SectionCard title="Historial de check-ins" subtitle="Últimas semanas">
            <div className="text-slate-500 text-sm py-4 text-center">
              Próximamente: historial completo de check-ins con gráficos.
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <SectionCard title="Evolución de peso">
            <div className="flex items-end gap-1 h-32 mt-2">
              {client.progress.weightHistory.map((w, i) => {
                const max = Math.max(...client.progress.weightHistory)
                const min = Math.min(...client.progress.weightHistory)
                const range = max - min || 1
                const heightPct = ((w - min) / range) * 80 + 20
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-slate-500 text-[9px]">{w}</span>
                    <div
                      className="w-full bg-accent/60 rounded-t-sm hover:bg-accent transition-colors"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-slate-600 text-[9px]">{client.progress.dates[i]}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/[0.05]">
              <span>Inicio: <span className="text-white font-semibold">{client.progress.weightHistory[0]} kg</span></span>
              <span>Actual: <span className="text-emerald-400 font-semibold">{client.progress.weightHistory[client.progress.weightHistory.length - 1]} kg</span></span>
              <span>Objetivo: <span className="text-accent font-semibold">{client.targetWeight} kg</span></span>
            </div>
          </SectionCard>

          <SectionCard title="Medidas corporales">
            <div className="flex flex-col gap-3">
              {[
                { label: 'Cintura', value: client.progress.measurements.waist, unit: 'cm' },
                { label: 'Caderas', value: client.progress.measurements.hips, unit: 'cm' },
                { label: 'Pecho', value: client.progress.measurements.chest, unit: 'cm' },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                  <span className="text-slate-400 text-sm">{m.label}</span>
                  <span className="text-white font-bold">{m.value} {m.unit}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Adherencia histórica" className="lg:col-span-2">
            <div className="flex flex-col gap-4">
              <ProgressBar label="Nutrición esta semana" value={client.adherenceNutrition} color="accent" />
              <ProgressBar label="Entrenamiento esta semana" value={client.adherenceTraining} color="emerald" />
            </div>
          </SectionCard>
        </div>
      )}
    </Layout>
  )
}

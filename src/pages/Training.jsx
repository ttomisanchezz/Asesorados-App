import { useState } from 'react'
import { Dumbbell, RefreshCw } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import { mockClients } from '../data/mockClients'

const DAY_LABELS = {
  'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'X', 'Jueves': 'J',
  'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D',
}
const ALL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function Training() {
  const [selected, setSelected] = useState(mockClients[0].id)
  const client = mockClients.find((c) => c.id === selected)

  return (
    <Layout>
      <PageHeader title="Entrenamiento" subtitle="Rutinas y progresión de cargas">
        <Button variant="secondary" size="sm" icon={RefreshCw}>
          Actualizar rutina
        </Button>
      </PageHeader>

      {/* Client selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {mockClients.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              selected === c.id
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'bg-[#111118] text-slate-400 border border-white/[0.06] hover:text-white'
            }`}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold"
              style={{ backgroundColor: c.avatarColor + '33', color: c.avatarColor }}
            >
              {c.avatar}
            </div>
            {c.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {client && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Plan info */}
          <SectionCard title="Plan activo">
            <div className="p-4 bg-accent/8 border border-accent/15 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Dumbbell size={16} className="text-accent" />
                <span className="text-accent font-semibold text-sm">{client.training.plan}</span>
              </div>
              <div className="text-slate-500 text-xs">{client.training.days.length} días por semana</div>
            </div>

            <div className="mb-4">
              <div className="text-slate-500 text-xs mb-3">Días activos</div>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_DAYS.map((day) => {
                  const active = client.training.days.includes(day)
                  return (
                    <div
                      key={day}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                        active
                          ? 'bg-accent text-white'
                          : 'bg-white/[0.04] text-slate-600'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <ProgressBar label="Adherencia entrenamiento" value={client.adherenceTraining} color="emerald" />
            </div>
          </SectionCard>

          {/* Exercises */}
          <SectionCard title="Ejercicios y cargas" subtitle={`${client.training.exercises.length} ejercicios`} className="lg:col-span-2">
            <div className="flex flex-col gap-2.5">
              {client.training.exercises.map((ex, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-slate-400 shrink-0 font-semibold text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold">{ex.name}</div>
                    {ex.notes && <div className="text-slate-500 text-xs mt-0.5">{ex.notes}</div>}
                  </div>
                  <div className="flex gap-4 shrink-0">
                    {ex.sets > 0 && (
                      <div className="text-center">
                        <div className="text-white font-bold text-base">{ex.sets}</div>
                        <div className="text-slate-600 text-[10px]">series</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-white font-bold text-base">{ex.reps}</div>
                      <div className="text-slate-600 text-[10px]">reps</div>
                    </div>
                    {ex.load && (
                      <div className="text-center">
                        <div className="text-accent font-bold text-base">{ex.load}</div>
                        <div className="text-slate-600 text-[10px]">carga</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* All clients overview */}
          <SectionCard title="Adherencia al entrenamiento" subtitle="Todos los asesorados" className="lg:col-span-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {mockClients.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.04] cursor-pointer hover:border-accent/20 transition-colors"
                  onClick={() => setSelected(c.id)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: c.avatarColor + '33', color: c.avatarColor }}
                    >
                      {c.avatar}
                    </div>
                    <div className="text-white text-xs font-medium truncate">{c.name.split(' ')[0]}</div>
                  </div>
                  <div className={`text-2xl font-bold ${c.adherenceTraining >= 85 ? 'text-emerald-400' : c.adherenceTraining >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {c.adherenceTraining}%
                  </div>
                  <div className="text-slate-600 text-xs mt-0.5">{c.training.plan}</div>
                  <ProgressBar
                    value={c.adherenceTraining}
                    color={c.adherenceTraining >= 85 ? 'emerald' : c.adherenceTraining >= 65 ? 'amber' : 'rose'}
                    showValue={false}
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </Layout>
  )
}

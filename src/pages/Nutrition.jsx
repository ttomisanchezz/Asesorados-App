import { useState } from 'react'
import { Utensils, TrendingUp, RefreshCw } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import { mockClients } from '../data/mockClients'

export default function Nutrition() {
  const [selected, setSelected] = useState(mockClients[0].id)
  const client = mockClients.find((c) => c.id === selected)

  const adherenceColor = (v) => v >= 85 ? 'text-emerald-400' : v >= 65 ? 'text-amber-400' : 'text-rose-400'

  return (
    <Layout>
      <PageHeader
        title="Nutrición"
        subtitle="Planes nutricionales de todos los asesorados"
      >
        <Button variant="secondary" size="sm" icon={RefreshCw}>
          Actualizar plan
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
          {/* Macro overview */}
          <SectionCard title="Objetivo calórico" subtitle={`Última actualización: ${new Date(client.nutrition.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}>
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-white mb-1">{client.nutrition.calories}</div>
              <div className="text-slate-500 text-sm">kcal / día</div>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <ProgressBar label={`Proteína — ${client.nutrition.protein}g`} value={client.nutrition.protein} max={250} color="accent" />
              <ProgressBar label={`Carbohidratos — ${client.nutrition.carbs}g`} value={client.nutrition.carbs} max={400} color="sky" />
              <ProgressBar label={`Grasas — ${client.nutrition.fat}g`} value={client.nutrition.fat} max={120} color="amber" />
            </div>
          </SectionCard>

          {/* Meals */}
          <SectionCard title="Plan de comidas" subtitle={`${client.nutrition.meals.length} comidas planificadas`} className="lg:col-span-2">
            <div className="flex flex-col gap-2.5">
              {client.nutrition.meals.map((meal, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3.5 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Utensils size={14} className="text-accent" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">{meal.name}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{meal.description}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-accent font-bold text-sm">{meal.calories}</div>
                    <div className="text-slate-600 text-xs">kcal</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-accent/5 rounded-xl border border-accent/15 mt-1">
                <span className="text-slate-400 text-sm font-medium">Total diario</span>
                <span className="text-accent font-bold">
                  {client.nutrition.meals.reduce((sum, m) => sum + m.calories, 0)} kcal
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Adherence overview */}
          <SectionCard title="Adherencia nutricional" subtitle="Resumen de todos los asesorados" className="lg:col-span-3">
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
                    <div className="min-w-0">
                      <div className="text-white text-xs font-medium truncate">{c.name.split(' ')[0]}</div>
                      <Badge variant={c.status} className="mt-0.5 text-[10px]" />
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${adherenceColor(c.adherenceNutrition)}`}>
                    {c.adherenceNutrition}%
                  </div>
                  <div className="text-slate-600 text-xs mt-0.5">adherencia</div>
                  <ProgressBar value={c.adherenceNutrition} color={c.adherenceNutrition >= 85 ? 'emerald' : c.adherenceNutrition >= 65 ? 'amber' : 'rose'} showValue={false} className="mt-2" />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </Layout>
  )
}

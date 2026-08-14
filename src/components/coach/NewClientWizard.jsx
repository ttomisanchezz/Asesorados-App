import { useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import NutritionPlanEditor from './NutritionPlanEditor'
import WorkoutPlanEditor from './WorkoutPlanEditor'
import { createClientWithAccess } from '../../services/clientService'

const inputClass = 'w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-accent/50'
const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500'
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const STEPS = ['Ficha', 'Acceso', 'Nutrición', 'Rutina']

const numberOrNull = (value) => value === '' ? null : Number(value)
const slug = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Field({ label, ...props }) {
  return <label><span className={labelClass}>{label}</span><input className={inputClass} {...props} /></label>
}
export default function NewClientWizard({ onCreated }) {
  const [step, setStep] = useState(0)
  const [personal, setPersonal] = useState({
    full_name: '', email: '', phone: '', objective: '', age: '', gender: '', weight: '',
    target_weight: '', height: '', experience: '', available_days: [], limitations: '',
    internal_notes: '', weekly_goal: '', next_review: '', status: 'active',
  })
  const [access, setAccess] = useState({ username: '', password: '' })
  const [nutritionPlan, setNutritionPlan] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nextPersonal = (event) => {
    event.preventDefault()
    setAccess((old) => ({ ...old, username: old.username || slug(personal.full_name) }))
    setStep(1)
  }
  const nextAccess = (event) => {
    event.preventDefault()
    if (access.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setError('')
    setStep(2)
  }
  const finish = async (workoutPlan) => {
    setBusy(true)
    setError('')
    const payload = {
      username: access.username,
      password: access.password,
      client: {
        ...personal,
        slug: slug(access.username),
        age: numberOrNull(personal.age), weight: numberOrNull(personal.weight),
        target_weight: numberOrNull(personal.target_weight), height: numberOrNull(personal.height),
        next_review: personal.next_review || null,
        avatar_initials: personal.full_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      },
      nutritionPlan,
      workoutPlan,
    }
    const { data, error: createError } = await createClientWithAccess(payload)
    setBusy(false)
    if (createError) return setError(createError.message || 'No se pudo crear el asesorado.')
    onCreated(data.client)
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className={`rounded-xl border px-2 py-2 text-center text-xs ${index === step ? 'border-accent/40 bg-accent/10 text-accent' : index < step ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400' : 'border-white/[0.06] text-slate-600'}`}>
            {index < step ? <Check size={13} className="mx-auto" /> : `${index + 1}. ${label}`}
          </div>
        ))}
      </div>

      {step === 0 && (
        <form onSubmit={nextPersonal} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nombre completo" value={personal.full_name} onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })} required /></div>
          <Field label="Email personal" type="email" value={personal.email} onChange={(e) => setPersonal({ ...personal, email: e.target.value })} />
          <Field label="Teléfono" value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
          <Field label="Objetivo" value={personal.objective} onChange={(e) => setPersonal({ ...personal, objective: e.target.value })} />
          <Field label="Género" value={personal.gender} onChange={(e) => setPersonal({ ...personal, gender: e.target.value })} />
          <Field label="Edad" type="number" min="0" value={personal.age} onChange={(e) => setPersonal({ ...personal, age: e.target.value })} />
          <Field label="Altura (cm)" type="number" min="0" value={personal.height} onChange={(e) => setPersonal({ ...personal, height: e.target.value })} />
          <Field label="Peso actual (kg)" type="number" min="0" step="0.1" value={personal.weight} onChange={(e) => setPersonal({ ...personal, weight: e.target.value })} />
          <Field label="Peso objetivo (kg)" type="number" min="0" step="0.1" value={personal.target_weight} onChange={(e) => setPersonal({ ...personal, target_weight: e.target.value })} />
          <Field label="Experiencia" value={personal.experience} onChange={(e) => setPersonal({ ...personal, experience: e.target.value })} />
          <Field label="Objetivo semanal" value={personal.weekly_goal} onChange={(e) => setPersonal({ ...personal, weekly_goal: e.target.value })} />
          <Field label="Próxima revisión" type="date" value={personal.next_review} onChange={(e) => setPersonal({ ...personal, next_review: e.target.value })} />
          <label><span className={labelClass}>Estado</span><select className={inputClass} value={personal.status} onChange={(e) => setPersonal({ ...personal, status: e.target.value })}><option value="active">Activo</option><option value="paused">Pausado</option><option value="finished">Finalizado</option></select></label>
          <div className="sm:col-span-2"><span className={labelClass}>Días disponibles</span><div className="flex flex-wrap gap-2">{DAYS.map((day) => <button key={day} type="button" onClick={() => setPersonal({ ...personal, available_days: personal.available_days.includes(day) ? personal.available_days.filter((item) => item !== day) : [...personal.available_days, day] })} className={`rounded-lg border px-2.5 py-1.5 text-xs ${personal.available_days.includes(day) ? 'border-accent/30 bg-accent/10 text-accent' : 'border-white/[0.07] text-slate-500'}`}>{day}</button>)}</div></div>
          <label className="sm:col-span-2"><span className={labelClass}>Limitaciones</span><textarea rows="2" className={inputClass} value={personal.limitations} onChange={(e) => setPersonal({ ...personal, limitations: e.target.value })} /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Notas internas</span><textarea rows="2" className={inputClass} value={personal.internal_notes} onChange={(e) => setPersonal({ ...personal, internal_notes: e.target.value })} /></label>
          <button className="sm:col-span-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">Continuar</button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={nextAccess} className="mx-auto flex max-w-lg flex-col gap-4">
          <p className="text-sm leading-relaxed text-slate-400">Estas son las credenciales que le vas a compartir. El usuario corto se transforma internamente en un email de acceso.</p>
          <Field label="Usuario" value={access.username} onChange={(e) => setAccess({ ...access, username: slug(e.target.value) })} required />
          <label><span className={labelClass}>Contraseña inicial</span><div className="relative"><input type={showPassword ? 'text' : 'password'} minLength="6" className={`${inputClass} pr-10`} value={access.password} onChange={(e) => setAccess({ ...access, password: e.target.value })} required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
          <div className="flex gap-2"><button type="button" onClick={() => setStep(0)} className="flex-1 rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-slate-300">Atrás</button><button className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">Continuar</button></div>
        </form>
      )}

      {step === 2 && <NutritionPlanEditor submitLabel="Guardar plan y continuar" onSubmit={(plan) => { setNutritionPlan(plan); setStep(3) }} />}
      {step === 3 && <WorkoutPlanEditor submitLabel="Crear asesorado" busy={busy} onSubmit={finish} />}
      {error && <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">{error}</p>}
      {step > 1 && !busy && <button type="button" onClick={() => setStep(step - 1)} className="mt-3 text-xs text-slate-500 hover:text-white">← Volver al paso anterior</button>}
    </div>
  )
}

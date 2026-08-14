import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function loginEmail(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized.includes('@') ? normalized : `${normalized}@asesorados.local`
}

function cleanClient(input: Record<string, unknown>, coachId: string, userId: string, email: string) {
  return {
    coach_id: coachId,
    user_id: userId,
    slug: String(input.slug || '').trim().toLowerCase() || null,
    full_name: String(input.full_name || '').trim(),
    email: String(input.email || '').trim() || email,
    phone: String(input.phone || '').trim() || null,
    objective: String(input.objective || '').trim() || null,
    age: input.age || null,
    gender: String(input.gender || '').trim() || null,
    weight: input.weight || null,
    target_weight: input.target_weight || null,
    height: input.height || null,
    experience: String(input.experience || '').trim() || null,
    available_days: Array.isArray(input.available_days) ? input.available_days : [],
    limitations: String(input.limitations || '').trim() || null,
    status: ['active', 'paused', 'finished'].includes(String(input.status)) ? input.status : 'active',
    avatar_initials: String(input.avatar_initials || '').trim() || null,
    avatar_color: String(input.avatar_color || '').trim() || null,
    internal_notes: String(input.internal_notes || '').trim() || null,
    weekly_goal: String(input.weekly_goal || '').trim() || null,
    next_review: input.next_review || null,
    last_checkin: input.last_checkin || null,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) return response({ error: 'Función sin configurar' }, 500)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'No autenticado' }, 401)

  const token = authorization.slice('Bearer '.length)
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

  const { data: userData, error: userError } = await caller.auth.getUser(token)
  if (userError || !userData.user) return response({ error: 'Sesión inválida' }, 401)

  const coachId = userData.user.id
  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('role')
    .eq('id', coachId)
    .single()
  if (profileError || profile?.role !== 'coach') return response({ error: 'Solo un coach puede crear clientes' }, 403)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return response({ error: 'Solicitud inválida' }, 400)
  }

  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  const clientInput = (body.client || {}) as Record<string, unknown>
  if (!username || !clientInput.full_name) return response({ error: 'Nombre y usuario son obligatorios' }, 400)
  if (password.length < 6) return response({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)

  const email = loginEmail(username)
  const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: String(clientInput.full_name).trim(), role: 'client' },
  })
  if (authError || !createdAuth.user) {
    const duplicate = /already|registered|exists/i.test(authError?.message || '')
    return response({ error: duplicate ? 'Ese usuario ya existe' : authError?.message || 'No se pudo crear el acceso' }, 409)
  }

  const authUserId = createdAuth.user.id
  let clientId: string | null = null
  try {
    // El trigger crea este perfil; el upsert lo deja explícitamente como cliente.
    const { error: pError } = await admin.from('profiles').upsert({
      id: authUserId,
      full_name: String(clientInput.full_name).trim(),
      role: 'client',
    })
    if (pError) throw pError

    const row = cleanClient({ ...clientInput, slug: clientInput.slug || username }, coachId, authUserId, email)
    const { data: client, error: clientError } = await caller
      .from('clients')
      .insert(row)
      .select()
      .single()
    if (clientError || !client) throw clientError || new Error('No se pudo crear la ficha')
    clientId = client.id

    const nutrition = body.nutritionPlan as Record<string, unknown> | undefined
    if (nutrition) {
      const { error } = await caller.from('nutrition_plans').insert({
        coach_id: coachId,
        client_id: clientId,
        title: String(nutrition.title || '').trim() || null,
        calories: nutrition.calories || null,
        protein: nutrition.protein || null,
        carbs: nutrition.carbs || null,
        fats: nutrition.fats ?? nutrition.fat ?? null,
        meals: Array.isArray(nutrition.meals) ? nutrition.meals : [],
        notes: String(nutrition.notes || '').trim() || null,
        active: true,
      })
      if (error) throw error
    }

    const workout = body.workoutPlan as Record<string, unknown> | undefined
    if (workout) {
      const { error } = await caller.from('workout_plans').insert({
        coach_id: coachId,
        client_id: clientId,
        title: String(workout.title || workout.plan || '').trim() || null,
        days: Array.isArray(workout.days) ? workout.days : [],
        exercises: Array.isArray(workout.exercises) ? workout.exercises : [],
        notes: String(workout.notes || '').trim() || null,
        active: true,
      })
      if (error) throw error
    }

    return response({ client, username, loginEmail: email }, 201)
  } catch (error) {
    // Compensación: las FK con cascade limpian planes; después se borra Auth.
    if (clientId) await admin.from('clients').delete().eq('id', clientId)
    await admin.auth.admin.deleteUser(authUserId)
    return response({ error: error instanceof Error ? error.message : 'No se pudo completar el alta' }, 400)
  }
})

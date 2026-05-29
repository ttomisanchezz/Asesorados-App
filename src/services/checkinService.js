import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockCheckins } from '../data/mockCheckins'

// ---------------------------------------------------------------------------
// Normaliza una fila real de checkins (snake_case) al shape camelCase del UI.
// Si ya viene en formato mock (tiene coachFeedback), se devuelve intacta.
// ---------------------------------------------------------------------------
function normalizeCheckin(row) {
  if (!row) return null
  if (row.coachFeedback !== undefined) return row // mock ya normalizado
  return {
    id: row.id,
    date: row.created_at ? String(row.created_at).slice(0, 10) : null,
    weight: row.weight ?? null,
    energy: row.energy ?? null,
    hunger: row.hunger ?? null,
    sleep: row.sleep ?? null,
    stress: row.stress ?? null,
    nutritionAdherence: row.nutrition_adherence ?? null,
    trainingAdherence: row.training_adherence ?? null,
    clientComment: row.client_comment ?? null,
    coachFeedback: row.coach_feedback ?? null,
    decision: row.decision ?? null,
  }
}

/**
 * Retorna los check-ins de un cliente (más recientes primero, normalizados).
 */
export async function getCheckins(clientId, limit = 10) {
  if (!isSupabaseConfigured) {
    const filtered = mockCheckins.filter((c) => c.clientId === clientId)
    return { data: filtered.map(normalizeCheckin), error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: error ? [] : (data ?? []).map(normalizeCheckin), error, source: 'supabase' }
}

/**
 * Retorna todos los check-ins recientes (para la vista del coach).
 */
export async function getAllRecentCheckins(limit = 20) {
  if (!isSupabaseConfigured) {
    return { data: mockCheckins, error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('checkins')
    .select('*, clients(full_name, avatar_initials, avatar_color)')
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data, error, source: 'supabase' }
}

/**
 * Retorna los check-ins del asesorado autenticado.
 */
export async function getMyCheckins(limit = 10) {
  if (!isSupabaseConfigured) {
    const client = mockCheckins[0]
    const filtered = client ? mockCheckins.filter((c) => c.clientId === client.clientId) : []
    return { data: filtered.map(normalizeCheckin), error: null, source: 'mock' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: new Error('No autenticado'), source: 'supabase' }

  const { data: clientData } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!clientData) return { data: [], error: null, source: 'supabase' }

  return getCheckins(clientData.id, limit)
}

/**
 * Crea un nuevo check-in.
 */
export async function createCheckin(clientId, payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('checkins')
    .insert({
      ...payload,
      client_id: clientId,
      coach_id: user.id,
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Agrega feedback del coach a un check-in existente.
 */
export async function addCoachFeedback(checkinId, { feedback, decision }) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data, error } = await supabase
    .from('checkins')
    .update({ coach_feedback: feedback, decision })
    .eq('id', checkinId)
    .select()
    .single()

  return { data, error }
}

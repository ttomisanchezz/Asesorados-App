import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { isHeicFile, heicFileToJpegFile } from '../lib/heicPhoto'

// ---------------------------------------------------------------------------
// Fotos de progreso del asesorado (check-ins).
// Tabla: checkin_photos (metadatos) + bucket privado 'progress-photos' (archivos).
// Ver migración 0004. Convención de path: {client_id}/{uuid}.{ext}
//
// El bucket es PRIVADO: las imágenes se sirven con URLs firmadas de corta
// duración (createSignedUrl), nunca con URL pública.
// Toda escritura corre con la sesión del navegador y la autoriza RLS:
// el asesorado solo toca lo suyo; el coach solo lee lo de sus clientes.
// ---------------------------------------------------------------------------

const BUCKET = 'progress-photos'
const SIGNED_URL_TTL = 60 * 60 // 1 hora

// Resuelve el client_id del asesorado autenticado.
async function resolveClient() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { client: null, error: new Error('No autenticado') }
  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (error || !client) {
    return { client: null, error: error || new Error('Perfil no encontrado'), reason: 'no-client' }
  }
  return { client, error: null }
}

// Extensión del archivo a partir del nombre o del mime-type. Fallback: jpg.
function fileExt(file) {
  const fromName = file?.name?.split('.').pop()
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) {
    return fromName.toLowerCase()
  }
  const fromType = file?.type?.split('/').pop()
  return (fromType || 'jpg').toLowerCase()
}

// Genera un identificador único para el nombre del archivo.
function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Agrega una URL firmada a cada fila de checkin_photos.
async function withSignedUrls(rows) {
  if (!rows?.length) return []
  const paths = rows.map((r) => r.storage_path)
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  if (error) {
    // Sin URL firmada igual devolvemos las filas (la miniatura quedará vacía).
    return rows.map((r) => ({ ...r, url: null }))
  }
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null }))
}

/**
 * Sube una foto al Storage privado y registra la fila en checkin_photos.
 * @param {File} file
 * @param {{ checkinId?: string, pose?: 'frente'|'perfil'|'espalda' }} [opts]
 * @returns {{ data: object|null, error: Error|null, reason?: string }}
 */
export async function uploadCheckinPhoto(file, { checkinId, pose } = {}) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }
  if (!file) return { data: null, error: new Error('No se recibió ningún archivo') }

  const { client, error, reason } = await resolveClient()
  if (!client) return { data: null, error: error || new Error('Perfil no encontrado'), reason }

  // HEIC (iPhone) no se puede mostrar en <img> en Chrome/Firefox: convertimos
  // a JPEG antes de subir. Si la conversión falla, sube el original y la vista
  // lo convierte al mostrar (useCheckinPhotoUrl).
  let upload = file
  if (isHeicFile(file)) {
    try {
      upload = await heicFileToJpegFile(file)
    } catch {
      upload = file
    }
  }

  const path = `${client.id}/${uid()}.${fileExt(upload)}`

  // 1) Subir el archivo al bucket privado.
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload, { cacheControl: '3600', upsert: false, contentType: upload.type || undefined })

  if (upErr) return { data: null, error: upErr }

  // 2) Registrar metadatos. Si falla, limpiamos el objeto para no dejar huérfanos.
  const { data, error: insErr } = await supabase
    .from('checkin_photos')
    .insert({
      client_id: client.id,
      checkin_id: checkinId || null,
      storage_path: path,
      pose: pose || null,
    })
    .select()
    .single()

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return { data: null, error: insErr }
  }

  const [withUrl] = await withSignedUrls([data])
  return { data: withUrl, error: null }
}

/**
 * Fotos del asesorado autenticado, con URL firmada (más recientes primero).
 */
export async function getMyCheckinPhotos() {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { client, error } = await resolveClient()
  if (!client) return { data: [], error, source: 'supabase' }

  return getClientCheckinPhotos(client.id)
}

/**
 * Fotos de un cliente, con URL firmada (para la vista del coach).
 */
export async function getClientCheckinPhotos(clientId) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { data, error } = await supabase
    .from('checkin_photos')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error, source: 'supabase' }

  return { data: await withSignedUrls(data ?? []), error: null, source: 'supabase' }
}

/**
 * Borra una foto: primero el objeto de Storage, luego la fila de metadatos.
 */
export async function deleteCheckinPhoto(id) {
  if (!isSupabaseConfigured) {
    return { error: new Error('Requiere Supabase configurado') }
  }

  // Necesitamos el path antes de borrar la fila.
  const { data: row, error: selErr } = await supabase
    .from('checkin_photos')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (selErr || !row) return { error: selErr || new Error('Foto no encontrada') }

  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.storage_path])
  if (rmErr) return { error: rmErr }

  const { error: delErr } = await supabase.from('checkin_photos').delete().eq('id', id)
  return { error: delErr }
}

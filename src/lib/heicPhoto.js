import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Soporte de fotos HEIC/HEIF (formato por defecto de iPhone).
// Chrome/Edge/Firefox NO decodifican HEIC en <img>: la URL firmada carga bien
// pero la imagen se ve rota. Estrategia en dos capas:
//   1. Al SUBIR: convertimos HEIC → JPEG en el navegador (heic2any, lazy).
//   2. Al MOSTRAR: las fotos HEIC ya existentes en Storage se convierten
//      on-the-fly y se cachean como object URL (cubre el historial sin
//      tocar los archivos de producción).
// heic2any se importa dinámicamente: solo paga el bundle quien toca un HEIC.
// ---------------------------------------------------------------------------

const HEIC_EXT_RE = /\.(heic|heif)$/i

/** ¿El path de Storage apunta a un archivo HEIC/HEIF? */
export function isHeicPath(path) {
  return HEIC_EXT_RE.test(path ?? '')
}

/** ¿El archivo elegido por el usuario es HEIC/HEIF? (por mime o extensión) */
export function isHeicFile(file) {
  if (!file) return false
  if (/heic|heif/i.test(file.type ?? '')) return true
  return isHeicPath(file.name)
}

// Convierte un Blob HEIC a Blob JPEG usando heic2any (import dinámico).
async function heicBlobToJpeg(blob) {
  const { default: heic2any } = await import('heic2any')
  const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 })
  return Array.isArray(out) ? out[0] : out
}

/** Convierte un File HEIC a File JPEG (mismo nombre con extensión .jpg). */
export async function heicFileToJpegFile(file) {
  const jpeg = await heicBlobToJpeg(file)
  const name = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg'
  return new File([jpeg], name, { type: 'image/jpeg' })
}

// Cache por foto: evita re-descargar y re-convertir el mismo HEIC en
// re-renders o al navegar entre tabs. Clave: id de la fila checkin_photos.
const displayUrlCache = new Map()

// Descarga el HEIC desde la URL firmada, lo convierte y devuelve un object URL.
function resolveHeicDisplayUrl(photo) {
  if (!displayUrlCache.has(photo.id)) {
    const promise = fetch(photo.url)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo descargar la foto (${r.status})`)
        return r.blob()
      })
      .then(heicBlobToJpeg)
      .then((jpeg) => URL.createObjectURL(jpeg))
      .catch(() => {
        // Falló la conversión: limpiar para reintentar en la próxima vista.
        displayUrlCache.delete(photo.id)
        return null
      })
    displayUrlCache.set(photo.id, promise)
  }
  return displayUrlCache.get(photo.id)
}

/**
 * URL lista para <img> de una foto de check-in.
 * Fotos comunes → la URL firmada tal cual. Fotos HEIC → conversión a JPEG
 * en el navegador, con estado de carga mientras convierte.
 * @returns {{ src: string|null, converting: boolean }}
 */
export function useCheckinPhotoUrl(photo) {
  const heic = isHeicPath(photo?.storage_path)
  // Estado etiquetado por foto: si cambia la foto, el resultado anterior se
  // descarta por derivación (sin setState sync en el effect para resetear).
  const [converted, setConverted] = useState(null) // { key, url: objectURL|'error' }
  const key = photo?.id ?? photo?.url ?? null

  useEffect(() => {
    if (!heic || !photo?.url) return undefined
    let active = true
    resolveHeicDisplayUrl(photo).then((url) => {
      if (active) setConverted({ key, url: url ?? 'error' })
    })
    return () => { active = false }
    // key + photo.url identifican la foto aunque cambie la referencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heic, key, photo?.url])

  if (!heic) return { src: photo?.url ?? null, converting: false }
  const current = converted?.key === key ? converted.url : null
  if (!photo?.url || current === 'error') return { src: null, converting: false }
  return { src: current, converting: current === null }
}

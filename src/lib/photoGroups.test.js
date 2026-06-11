import { describe, it, expect } from 'vitest'
import { groupPhotosByDay } from './photoGroups'

describe('groupPhotosByDay', () => {
  it('agrupa por día local, días del más reciente al más antiguo', () => {
    const photos = [
      { id: '1', created_at: '2026-06-01T12:00:00' },
      { id: '2', created_at: '2026-06-03T12:00:00' },
      { id: '3', created_at: '2026-06-03T18:00:00' },
    ]
    const out = groupPhotosByDay(photos)
    expect(out.map((d) => d.key)).toEqual(['2026-06-03', '2026-06-01'])
    // dentro del día más reciente, la foto más nueva primero
    expect(out[0].photos.map((p) => p.id)).toEqual(['3', '2'])
  })

  it('cada grupo expone date = medianoche local de ese día', () => {
    const [grupo] = groupPhotosByDay([{ id: '1', created_at: '2026-06-03T18:00:00' }])
    expect(grupo.date.getFullYear()).toBe(2026)
    expect(grupo.date.getMonth()).toBe(5) // junio (0-indexed)
    expect(grupo.date.getDate()).toBe(3)
    expect(grupo.date.getHours()).toBe(0)
  })

  it('usa taken_at como fallback e ignora fotos sin fecha', () => {
    const out = groupPhotosByDay([
      { id: 'a', taken_at: '2026-06-05T10:00:00' },
      { id: 'b' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].photos.map((p) => p.id)).toEqual(['a'])
  })

  it('tolera null/undefined', () => {
    expect(groupPhotosByDay(null)).toEqual([])
    expect(groupPhotosByDay(undefined)).toEqual([])
  })
})

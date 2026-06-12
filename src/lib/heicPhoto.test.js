import { describe, it, expect } from 'vitest'
import { isHeicPath, isHeicFile } from './heicPhoto'

describe('isHeicPath', () => {
  it('detecta extensiones heic/heif sin importar mayúsculas', () => {
    expect(isHeicPath('c1/foto.heic')).toBe(true)
    expect(isHeicPath('c1/foto.HEIC')).toBe(true)
    expect(isHeicPath('c1/foto.heif')).toBe(true)
  })

  it('no marca formatos comunes ni paths vacíos', () => {
    expect(isHeicPath('c1/foto.jpg')).toBe(false)
    expect(isHeicPath('c1/foto.png')).toBe(false)
    expect(isHeicPath(null)).toBe(false)
    expect(isHeicPath(undefined)).toBe(false)
  })
})

describe('isHeicFile', () => {
  it('detecta por mime-type', () => {
    expect(isHeicFile({ name: 'foto', type: 'image/heic' })).toBe(true)
    expect(isHeicFile({ name: 'foto', type: 'image/heif' })).toBe(true)
  })

  it('detecta por extensión cuando el type viene vacío (caso Windows/Chrome)', () => {
    expect(isHeicFile({ name: 'IMG_001.HEIC', type: '' })).toBe(true)
  })

  it('no marca imágenes comunes ni valores nulos', () => {
    expect(isHeicFile({ name: 'foto.jpg', type: 'image/jpeg' })).toBe(false)
    expect(isHeicFile(null)).toBe(false)
  })
})

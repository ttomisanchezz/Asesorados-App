import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Dumbbell, Utensils, TrendingUp, MessageSquare,
  Video, ClipboardCheck, RefreshCw, XCircle, CheckCircle,
  ArrowRight, Star, Target, User, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Button from '../components/ui/Button'

const WHATSAPP_PHONE = '5492984409447'
const WHATSAPP_MESSAGE = 'Hola Tomi, quiero empezar mi asesoría fitness. Me interesa recibir más información sobre los planes.'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

const COACH_PROGRESS = '/landing/coach-progress.jpg'
const COACH_IMG2     = '/fotos/img2home.jpg'
const COACH_IMG3     = '/fotos/img3home.png'
const COACH_IMG4     = '/fotos/img4quiensoy.jpg'
const COACH_IMG6     = '/fotos/img6.jpg'
const COACH_IMG7     = '/fotos/img7.png'

const handleScrollTo = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

// ── Accordion card para "Qué incluye" ──────────────────────────────────────
// IMPORTANTE: fade-up NO va en este div — va en el wrapper externo del grid.
// Si fade-up estuviera aquí, React borraría la clase "visible" al re-renderizar
// por el cambio de estado `open`, dejando el card invisible.
function FeatureCard({ icon: Icon, title, desc, featured = false }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={`group relative border rounded-2xl cursor-pointer overflow-hidden transition-colors duration-200 ${
        featured
          ? 'bg-accent/[0.05] border-accent/25 hover:border-accent/40'
          : 'bg-[#111118] border-white/[0.06] hover:border-accent/20'
      } ${open ? (featured ? 'border-accent/40' : 'border-accent/25') : ''}`}
      onClick={() => setOpen((o) => !o)}
    >
      {/* Badge featured — desktop */}
      {featured && (
        <div className="absolute top-4 right-12 hidden sm:flex items-center">
          <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/20 text-accent text-[10px] font-semibold tracking-wide whitespace-nowrap">
            Clave para progresar
          </span>
        </div>
      )}

      {/* Header siempre visible */}
      <div className="flex items-center gap-4 p-5 select-none">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
            open || featured
              ? 'bg-accent/20'
              : 'bg-accent/10 group-hover:bg-accent/15'
          }`}
        >
          <Icon size={20} className="text-accent" />
        </div>

        <span className="flex-1 text-white font-semibold text-sm leading-snug">
          {title}
        </span>

        {/* Badge featured — mobile */}
        {featured && (
          <span className="sm:hidden px-2 py-0.5 rounded-full bg-accent/15 border border-accent/20 text-accent text-[10px] font-semibold whitespace-nowrap mr-1">
            Clave
          </span>
        )}

        <ChevronDown
          size={17}
          className={`shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-accent' : 'text-slate-600'
          }`}
        />
      </div>

      {/* Body expandible */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 pb-5">
          <div className="h-px bg-white/[0.05] mb-4" />
          <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  )
}

// ── Testimonial Card ────────────────────────────────────────────────────────
function TestimonialCard({ initials, colorBg, colorText, name, goal, text }) {
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6 flex flex-col gap-4 hover:border-white/10 transition-colors duration-200 h-full">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${colorBg} ${colorText} flex items-center justify-center font-bold text-sm shrink-0`}>
          {initials}
        </div>
        <div>
          <div className="text-white font-semibold text-sm">{name}</div>
          <div className="text-slate-500 text-xs">{goal}</div>
        </div>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed flex-1">
        "{text}"
      </p>
      <div className="h-px bg-white/[0.04]" />
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((s) => (
          <Star key={s} size={12} className="text-accent" fill="currentColor" />
        ))}
      </div>
    </div>
  )
}

// ── Utilidad pura: divide un array en chunks de tamaño n ───────────────────
const chunkArray = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ── Testimonials Carousel ───────────────────────────────────────────────────
// MODELO: páginas/chunks — no ventana deslizante.
//   pages = chunkArray(TESTIMONIALS, perView)
//   currentPage navega entre páginas completas → cero overlap entre slides.
//   Último chunk puede tener menos cards: se centra visualmente con flex.
//   pageRef / fadingRef / perViewRef — refs para evitar stale closures.
function TestimonialsCarousel() {
  const calcPerView = () => {
    if (typeof window === 'undefined') return 3
    if (window.innerWidth >= 1024) return 3
    if (window.innerWidth >= 640) return 2
    return 1
  }

  const [perView, setPerView] = useState(calcPerView)
  const [currentPage, setCurrentPage] = useState(0)
  const [fading, setFading] = useState(false)
  const [paused, setPaused] = useState(false)
  const pageRef = useRef(0)
  const fadingRef = useRef(false)
  const perViewRef = useRef(perView)

  // Resize: recalcular perView y resetear a página 0
  useEffect(() => {
    const update = () => {
      const pv = calcPerView()
      perViewRef.current = pv
      setPerView(pv)
      pageRef.current = 0
      setCurrentPage(0)
    }
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  // Navegar a una página con fade 220ms y wrap circular entre páginas
  const goToPage = (raw) => {
    if (fadingRef.current) return
    const n = chunkArray(TESTIMONIALS, perViewRef.current).length
    const next = ((raw % n) + n) % n
    fadingRef.current = true
    setFading(true)
    setTimeout(() => {
      pageRef.current = next
      setCurrentPage(next)
      fadingRef.current = false
      setFading(false)
    }, 220)
  }

  // Auto-rotate: avanza por página entera cada 4 segundos
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      if (fadingRef.current) return
      const n = chunkArray(TESTIMONIALS, perViewRef.current).length
      const next = (pageRef.current + 1) % n
      fadingRef.current = true
      setFading(true)
      setTimeout(() => {
        pageRef.current = next
        setCurrentPage(next)
        fadingRef.current = false
        setFading(false)
      }, 220)
    }, 4000)
    return () => clearInterval(id)
  }, [paused])

  const pages = chunkArray(TESTIMONIALS, perView)
  const numPages = pages.length
  const currentCards = pages[currentPage] ?? pages[0]
  const isFull = currentCards.length === perView
  const pageStart = currentPage * perView

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Cards: grid cuando la página está llena, flex centrado si es el último chunk parcial */}
      <div
        className="gap-4 transition-opacity duration-200"
        style={{
          opacity: fading ? 0 : 1,
          display: isFull ? 'grid' : 'flex',
          gridTemplateColumns: isFull ? `repeat(${perView}, minmax(0, 1fr))` : undefined,
          justifyContent: !isFull ? 'center' : undefined,
        }}
      >
        {currentCards.map((data, k) => (
          <div
            key={pageStart + k}
            style={!isFull
              ? { flex: `0 0 calc((100% - ${(perView - 1) * 16}px) / ${perView})` }
              : {}
            }
          >
            <TestimonialCard {...data} />
          </div>
        ))}
      </div>

      {/* Controles: flecha · dots por página · flecha */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={() => goToPage(pageRef.current - 1)}
          className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-accent/30 flex items-center justify-center text-slate-500 hover:text-accent transition-all duration-200"
          aria-label="Anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: numPages }, (_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentPage
                  ? 'w-5 h-2 bg-accent'
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Ir al grupo ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => goToPage(pageRef.current + 1)}
          className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-accent/30 flex items-center justify-center text-slate-500 hover:text-accent transition-all duration-200"
          aria-label="Siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Datos ──────────────────────────────────────────────────────────────────

const PROBLEMS = [
  { number: '01', text: 'No sabés si progresás o solo repetís entrenamientos' },
  { number: '02', text: 'Cambiás de rutina sin criterio y perdés continuidad' },
  { number: '03', text: "Comés 'más o menos bien', pero sin saber si estás en déficit o superávit" },
  { number: '04', text: 'No medís peso, fotos, medidas ni rendimiento para tomar decisiones' },
]

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Formulario inicial',
    desc: 'Recolecto tus datos, horarios, experiencia, objetivo y disponibilidad para armar un plan realista desde tu punto de partida.',
    featured: false,
  },
  {
    icon: Utensils,
    title: 'Plan alimenticio flexible',
    desc: 'Opciones de comidas reales, sostenibles y ajustadas a tu rutina, sin dietas imposibles de mantener.',
    featured: false,
  },
  {
    icon: Dumbbell,
    title: 'Entrenamiento personalizado',
    desc: 'Rutina adaptada a tu nivel, objetivo, días disponibles y ejercicios que realmente podés sostener.',
    featured: false,
  },
  {
    icon: Video,
    title: 'Corrección técnica',
    desc: 'Durante la primera semana reviso tus videos para corregir ejecución, mejorar estímulo y prevenir molestias.',
    featured: false,
  },
  {
    icon: TrendingUp,
    title: 'Seguimiento semanal',
    desc: 'Revisión de peso, medidas, fotos, rendimiento y sensaciones para saber si vamos por el camino correcto.',
    featured: true,
  },
  {
    icon: MessageSquare,
    title: 'Contacto directo',
    desc: 'Acompañamiento para resolver dudas sobre técnica, comidas, organización o ajustes puntuales.',
    featured: false,
  },
  {
    icon: RefreshCw,
    title: 'Ajustes según evolución',
    desc: 'El plan no queda fijo: se modifica según tu progreso, adherencia, energía y respuesta física.',
    featured: false,
  },
]

const STEPS = [
  {
    number: '01',
    icon: ClipboardCheck,
    title: 'Completás el formulario inicial',
    desc: 'Objetivo, nivel, disponibilidad, preferencias y datos corporales.',
  },
  {
    number: '02',
    icon: Dumbbell,
    title: 'Recibís tu plan personalizado',
    desc: 'Rutina y plan alimenticio armados específicamente para vos.',
  },
  {
    number: '03',
    icon: Video,
    title: 'Enviás registros y videos',
    desc: 'Peso semanal, fotos, sensaciones y videos de técnica la primera semana.',
  },
  {
    number: '04',
    icon: TrendingUp,
    title: 'Ajustamos semana a semana',
    desc: 'Con tus datos reales, el plan evoluciona con vos en cada ciclo.',
  },
]

const TESTIMONIALS = [
  {
    initials: 'S',
    name: 'Santiago',
    colorBg: 'bg-accent/20',
    colorText: 'text-accent',
    goal: 'Ganar masa muscular',
    text: 'Aprendió a organizar comidas, registrar cargas y sostener una rutina semanal con ajustes reales semana a semana.',
  },
  {
    initials: 'E',
    name: 'Ezequiel',
    colorBg: 'bg-emerald-500/20',
    colorText: 'text-emerald-400',
    goal: 'Mejorar composición corporal',
    text: 'Mejoró adherencia, técnica y constancia con un proceso más simple, medible y cercano.',
  },
  {
    initials: 'M',
    name: 'Mateo',
    colorBg: 'bg-sky-500/20',
    colorText: 'text-sky-400',
    goal: 'Volver a entrenar con estructura',
    text: 'Después de meses sin entrenar, el plan me dio una base clara desde el primer día. Los ajustes semanales me ayudaron a retomar el ritmo sin quemarme en el intento.',
  },
  {
    initials: 'F',
    name: 'Franco',
    colorBg: 'bg-orange-500/20',
    colorText: 'text-orange-400',
    goal: 'Ganar fuerza y masa muscular',
    text: 'Quería ganar fuerza de verdad, no solo volumen. Con el seguimiento pude ver el progreso en cargas semana a semana y entender cómo alimentarme para sostenerlo.',
  },
  {
    initials: 'L',
    name: 'Lu',
    colorBg: 'bg-pink-500/20',
    colorText: 'text-pink-400',
    goal: 'Bajar grasa sin extremos',
    text: 'Necesitaba un enfoque que no me hiciera sentir en dieta permanente. Pude bajar grasa sin sacrificar energía ni calidad de vida, con comidas reales y sostenibles.',
  },
  {
    initials: 'R',
    name: 'Rocío',
    colorBg: 'bg-teal-500/20',
    colorText: 'text-teal-400',
    goal: 'Crear hábitos sostenibles',
    text: 'Lo que más me ayudó fue aprender a ser constante sin ser perfecta. El plan se adaptaba a mis semanas reales y eso hizo toda la diferencia para mantenerlo en el tiempo.',
  },
  {
    initials: 'A',
    name: 'Alejandro',
    colorBg: 'bg-amber-500/20',
    colorText: 'text-amber-400',
    goal: 'Salir del estancamiento',
    text: 'Venía entrenando pero sin dirección. Empezar a medir peso, cargas, fotos y sensaciones me ayudó a ajustar con criterio y volver a progresar.',
  },
]

const PLANS = [
  {
    name: 'Plan Básico',
    price: '$65.000',
    currency: 'ARS / mes',
    description: 'Entrenamiento, alimentación y seguimiento semanal con contacto directo.',
    features: [
      'Entrenamiento personalizado',
      'Opciones de alimentación',
      'Seguimiento semanal',
      'Contacto 24/7',
      'Formulario inicial',
      'Corrección técnica primera semana',
    ],
    highlight: false,
  },
  {
    name: 'Plan Presencial',
    price: '$95.000',
    currency: 'ARS / mes',
    description: 'Todo lo del plan básico más una sesión de entrenamiento presencial por semana conmigo.',
    features: [
      'Todo lo del Plan Básico',
      '1 sesión presencial semanal',
      'Corrección en vivo',
      'Más seguridad técnica',
      'Experiencia más guiada',
    ],
    highlight: true,
  },
]

// ── Carousel "Quién soy" ────────────────────────────────────────────────────
//
// Comportamiento:
//   · Autoplay arranca solo cuando la sección entra en viewport (IntersectionObserver).
//   · Se pausa si el usuario hace hover sobre la imagen.
//   · Crossfade de opacidad (700ms) entre slides — nada brusco.
//   · prefers-reduced-motion: si está activo, no hay autoplay ni transición.
//   · Navegación manual: botones prev/next + dots clickeables.
//   · Refs para todos los valores dinámicos dentro del interval (sin stale closures).

const QUIEN_SOY_SLIDES = [
  { src: COACH_PROGRESS, alt: 'Coach de asesoramiento fitness'    },
  { src: COACH_IMG2,     alt: 'Resultado de asesoría fitness'     },
  { src: COACH_IMG3,     alt: 'Transformación física real'        },
  { src: COACH_IMG4,     alt: 'Proceso de entrenamiento real'     },
  { src: COACH_IMG6,     alt: 'Resultados reales del método'      },
  { src: COACH_IMG7,     alt: 'Evolución física del coach'         },
]

function QuienSoyCarousel() {
  const [idx, setIdx]  = useState(0)
  const idxRef         = useRef(0)
  const inViewRef      = useRef(false)
  const hoveredRef     = useRef(false)
  const intervalRef    = useRef(null)
  const containerRef   = useRef(null)

  function goTo(raw) {
    const n = ((raw % QUIEN_SOY_SLIDES.length) + QUIEN_SOY_SLIDES.length) % QUIEN_SOY_SLIDES.length
    idxRef.current = n
    setIdx(n)
  }

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function tick() {
      if (inViewRef.current && !hoveredRef.current) {
        const next = (idxRef.current + 1) % QUIEN_SOY_SLIDES.length
        idxRef.current = next
        setIdx(next)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting
        if (entry.isIntersecting && !prefersReduced) {
          clearInterval(intervalRef.current)
          intervalRef.current = setInterval(tick, 4200)
        } else {
          clearInterval(intervalRef.current)
        }
      },
      { threshold: 0.25 },
    )

    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      clearInterval(intervalRef.current)
    }
  }, [])

  return (
    /*
      w-full SIN aspect-ratio ni maxHeight: el container toma todo el ancho del
      padre y tiene altura fija por breakpoint.

      Por qué: aspect-ratio + max-height juntos hacen que el browser ACHIQUE EL
      ANCHO para mantener la proporción cuando se activa maxHeight — el carousel
      terminaba siendo ~345px de ancho mientras la badge debajo era ~520px.
      Con h-fijo el container siempre es w-full, y la badge hereda el mismo ancho.
    */
    <div
      ref={containerRef}
      className="relative w-full h-80 sm:h-96 lg:h-[420px]
                 rounded-3xl overflow-hidden shadow-2xl"
      onMouseEnter={() => { hoveredRef.current = true  }}
      onMouseLeave={() => { hoveredRef.current = false }}
      role="region"
      aria-label="Galería de fotos"
    >
      {/*
        ── Técnica: blur-backdrop + object-contain ──

        Cada slide tiene DOS capas:
          1. La misma imagen de fondo, muy difuminada y oscurecida.
             Llena el frame y oculta el espacio vacío (letterbox).
          2. La imagen principal con object-contain — se ve COMPLETA,
             sin recortes agresivos, centrada sobre el fondo blur.

        Esto garantiza que cualquier foto (portrait, landscape, cuadrada)
        se vea bien dentro del frame sin deformarla ni cortarla.
      */}
      {QUIEN_SOY_SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={[
            'absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none',
            i === idx ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          {/* Capa 1 — fondo blur: misma imagen, escalada y muy difuminada */}
          <img
            src={slide.src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-105 blur-2xl opacity-40"
          />
          {/* Overlay oscuro sobre el fondo — mantiene el vibe dark premium */}
          <div className="absolute inset-0 bg-[#0a0a0f]/40" />
          {/* Capa 2 — imagen principal, contenida y centrada */}
          <img
            src={slide.src}
            alt={slide.alt}
            className="absolute inset-0 w-full h-full object-contain z-10"
          />
        </div>
      ))}

      {/* Degradado inferior — sobre todo, pointer-events-none */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/65 via-transparent to-transparent pointer-events-none z-20" />

      {/* ── Botón anterior ── */}
      <button
        onClick={() => goTo(idx - 1)}
        aria-label="Foto anterior"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-30
                   w-9 h-9 rounded-xl flex items-center justify-center
                   bg-[#0a0a0f]/55 backdrop-blur-sm border border-white/[0.10]
                   text-white/65 hover:text-white hover:bg-[#0a0a0f]/80
                   hover:border-white/20 transition-all duration-200"
      >
        <ChevronLeft size={16} />
      </button>

      {/* ── Botón siguiente ── */}
      <button
        onClick={() => goTo(idx + 1)}
        aria-label="Foto siguiente"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-30
                   w-9 h-9 rounded-xl flex items-center justify-center
                   bg-[#0a0a0f]/55 backdrop-blur-sm border border-white/[0.10]
                   text-white/65 hover:text-white hover:bg-[#0a0a0f]/80
                   hover:border-white/20 transition-all duration-200"
      >
        <ChevronRight size={16} />
      </button>

      {/* ── Dots ── */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2"
        role="tablist"
        aria-label="Indicadores de imagen"
      >
        {QUIEN_SOY_SLIDES.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === idx}
            aria-label={`Foto ${i + 1}`}
            onClick={() => goTo(i)}
            className={[
              'rounded-full transition-all duration-300 motion-reduce:transition-none',
              i === idx
                ? 'w-5 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/60',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  // Sombra en navbar al hacer scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll reveal con IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -28px 0px' }
    )
    document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden pb-24 md:pb-0">

      {/* ── STICKY MOBILE CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/[0.06] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={() => window.open(WHATSAPP_URL, '_blank')}
          className="w-full bg-accent text-white font-semibold rounded-xl py-3.5 text-base flex items-center justify-center gap-2 shadow-glow active:scale-[0.98] transition-transform"
        >
          Quiero empezar <ArrowRight size={18} />
        </button>
      </div>

      {/* ── NAVBAR ── */}
      <nav
        className={`sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b transition-all duration-300 ${
          scrolled
            ? 'border-white/[0.08] shadow-[0_4px_32px_rgba(0,0,0,0.5)]'
            : 'border-white/[0.05] shadow-none'
        } overflow-x-hidden`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent flex items-center justify-center shrink-0 shadow-glow">
              <Zap size={15} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-sm sm:text-base truncate">
              Asesoramiento Fitness
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <a href="#que-incluye" className="text-slate-400 hover:text-white text-sm transition-colors duration-150">
              Qué incluye
            </a>
            <a href="#como-funciona" className="text-slate-400 hover:text-white text-sm transition-colors duration-150">
              Cómo funciona
            </a>
            <a href="#planes" className="text-slate-400 hover:text-white text-sm transition-colors duration-150">
              Planes
            </a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:block text-slate-400 hover:text-white text-sm transition-colors duration-150 px-3 py-2 rounded-xl hover:bg-white/5"
            >
              Ya soy alumno
            </button>
            <Button
              size="sm"
              onClick={() => window.open(WHATSAPP_URL, '_blank')}
              className="shrink-0 !px-3 !py-2 !text-xs sm:!text-sm whitespace-nowrap"
            >
              Quiero empezar
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">

        {/* Fondo de gimnasio — cubre todo el hero */}
        <img
          src="/fotos/hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none ken-burns"
        />

        {/* Capas de overlay para legibilidad y estética */}
        {/* 1. Base oscura general */}
        <div className="absolute inset-0 bg-[#0a0a0f]/55 pointer-events-none" />
        {/* 2. Gradiente izquierda → zona de texto siempre legible */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent pointer-events-none" />
        {/* 3. Gradiente inferior → blend suave con la siguiente sección */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/30 to-transparent pointer-events-none" />
        {/* 4. Blend con el navbar */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#0a0a0f]/55 to-transparent pointer-events-none" />
        {/* 5. Glow violeta derecha — zona lista para el PNG del coach */}
        <div className="hidden md:block absolute right-0 top-0 bottom-0 w-1/2 bg-accent/[0.04] blur-[100px] pointer-events-none" />

        {/* Glow detrás del coach — centrado verticalmente en la mitad derecha */}
        <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.07] blur-[100px] pointer-events-none z-[12]" />

        {/* Contenido — grid 2 cols en lg+ */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 lg:pt-8 pb-16 sm:pb-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1fr_0.85fr] items-start gap-8 lg:gap-12">

            {/* ── Columna izquierda: texto + pills ── */}
            <div className="relative z-30">

              <div className="fade-up inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] sm:text-xs font-semibold mb-4">
                <Star size={11} fill="currentColor" />
                Asesoramiento Fitness Personalizado
              </div>

              <p className="fade-up text-slate-400 text-sm font-medium mb-5 sm:mb-6 tracking-wide">
                por <span className="text-slate-200 font-semibold">Tomás Sánchez</span>
              </p>

              <h1 className="fade-up text-[2.4rem] sm:text-[3.2rem] lg:text-[3.8rem] font-extrabold text-white leading-[1.05] tracking-tighter mb-5 sm:mb-6">
                Transformá tu físico con un plan claro, seguimiento semanal y{' '}
                <span className="text-gradient">ajustes reales</span>
              </h1>

              <p className="fade-up text-slate-300 text-[15px] sm:text-lg leading-relaxed mb-7 sm:mb-9">
                Entrenamiento personalizado, alimentación flexible y correcciones técnicas para que avances con método, datos y acompañamiento real.
              </p>

              <div className="fade-up flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
                <Button
                  size="lg"
                  iconRight={ArrowRight}
                  onClick={() => handleScrollTo('como-funciona')}
                  className="w-full sm:w-auto justify-center active:scale-[0.98] transition-transform"
                >
                  Quiero empezar mi asesoría
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto justify-center active:scale-[0.98] transition-transform"
                >
                  Ya soy alumno
                </Button>
              </div>

              <div className="fade-up flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[0,1,2,3,4].map(i => <Star key={i} size={11} className="text-accent" fill="currentColor" />)}
                  </div>
                  <span className="text-slate-300 text-xs font-medium">5.0</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <span className="w-1 h-1 rounded-full bg-slate-600 hidden sm:block" />
                  <span>Plan personalizado</span>
                  <span className="text-slate-600">·</span>
                  <span>Contacto 24/7</span>
                </div>
              </div>

              {/* Stat pills glassmorphism */}
              <div className="fade-up hidden sm:flex flex-wrap gap-3 mt-8 lg:mt-10">
                <div className="flex items-center gap-2.5 bg-white/[0.07] backdrop-blur-sm border border-white/[0.10] rounded-xl px-3.5 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/15 flex items-center justify-center shrink-0">
                    <TrendingUp size={13} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-xs">Progreso real</div>
                    <div className="text-slate-400 text-[10px]">Semana a semana</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.07] backdrop-blur-sm border border-accent/[0.18] rounded-xl px-3.5 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/15 flex items-center justify-center shrink-0">
                    <Star size={12} className="text-accent" fill="currentColor" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-xs">Alta valoración</div>
                    <div className="text-slate-400 text-[10px]">De mis alumnos</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.07] backdrop-blur-sm border border-white/[0.10] rounded-xl px-3.5 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/10 flex items-center justify-center shrink-0">
                    <Zap size={13} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-xs">Plan personalizado</div>
                    <div className="text-slate-400 text-[10px]">Desde el día uno</div>
                  </div>
                </div>
              </div>

              {/* Coach — mobile: imagen sola con glow */}
              <div className="lg:hidden mt-10 flex justify-center">
                <div className="relative float-image">
                  <div className="absolute -inset-6 bg-accent/[0.08] blur-[60px] rounded-full pointer-events-none" />
                  <img
                    src="/fotos/coach.png"
                    alt="Coach de asesoramiento fitness"
                    className="relative z-10 max-h-[320px] w-auto object-contain select-none"
                  />
                </div>
              </div>

            </div>

            {/* ── Columna derecha: imagen integrada sobre el fondo — solo lg+ ── */}
            <div className="hidden lg:flex items-start justify-center relative z-20 pt-2">
              <div className="relative float-image">

                {/* Glow sutil detrás — sin card visible */}
                <div className="absolute -inset-10 bg-accent/[0.10] blur-[90px] rounded-full pointer-events-none" />

                {/* Firma visual — nombre arriba de la imagen */}
                <div className="absolute top-5 inset-x-0 z-20 flex items-center justify-center gap-3 select-none pointer-events-none">
                  <div className="h-px w-6 bg-white/20" />
                  <span className="text-white/50 text-[10px] font-semibold tracking-[0.24em] uppercase">Tomás Sánchez</span>
                  <div className="h-px w-6 bg-white/20" />
                </div>

                {/* Imagen directa sobre el fondo del hero */}
                <img
                  src="/fotos/coach.png"
                  alt="Coach de asesoramiento fitness"
                  className="relative z-10 max-h-[520px] xl:max-h-[580px] w-auto object-contain select-none"
                />

                {/* Floating stat card */}
                <div className="absolute -bottom-2 -left-10 z-20 flex items-center gap-3 bg-[#0e0e18]/90 backdrop-blur-md border border-white/[0.10] rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/15 flex items-center justify-center shrink-0">
                    <TrendingUp size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-tight">Progreso real</div>
                    <div className="text-slate-400 text-xs mt-0.5">Con datos, no suposiciones</div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section id="problema" className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-12 fade-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Si entrenás sin método, es fácil estancarte
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              No siempre falta esfuerzo. Muchas veces falta una estructura clara, seguimiento y ajustes según cómo responde tu cuerpo.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {PROBLEMS.map(({ number, text }, i) => (
              <div
                key={number}
                className="fade-up relative flex items-start gap-4 bg-[#111118] border border-white/[0.05] rounded-2xl p-6 overflow-hidden hover:border-white/10 transition-colors duration-200"
                style={{ transitionDelay: `${i * 0.06}s` }}
              >
                <span className="absolute right-4 top-2 text-6xl font-black text-white/[0.035] select-none leading-none pointer-events-none">
                  {number}
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <XCircle size={16} className="text-rose-400" />
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <div className="fade-up bg-accent/[0.06] border border-accent/20 rounded-2xl p-7">
            <p className="text-white font-semibold text-lg mb-1.5">
              El objetivo no es darte un plan genérico.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Es acompañarte con una estructura clara, adaptable y sostenible para que puedas avanzar semana a semana.
            </p>
          </div>
        </div>
      </section>

      {/* ── QUÉ INCLUYE ── */}
      <section id="que-incluye" className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">

          {/* Encabezado */}
          <div className="max-w-2xl mx-auto text-center mb-12 fade-up">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-semibold tracking-widest uppercase mb-5">
              Incluye en tu plan
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Un acompañamiento completo para que sepas qué hacer cada semana
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Entrenamiento, alimentación, seguimiento y correcciones pensadas para tu objetivo, tu rutina y tu nivel actual.
            </p>
          </div>

          {/* Cards accordion — fade-up en wrapper externo para que React
              no borre la clase "visible" al cambiar el estado open */}
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className="fade-up"
                style={{ transitionDelay: `${i * 0.05}s` }}
              >
                <FeatureCard {...feature} />
              </div>
            ))}
          </div>

          {/* CTA debajo de las cards */}
          <div className="fade-up bg-[#111118] border border-white/[0.06] rounded-2xl p-8 text-center">
            <p className="text-white font-semibold text-lg mb-1.5">
              No necesitás hacerlo perfecto. Necesitás un plan claro y seguimiento real.
            </p>
            <p className="text-slate-500 text-sm mb-7">
              Empezá con lo que tenés hoy y ajustamos en el camino.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                iconRight={ArrowRight}
                onClick={() => window.open(WHATSAPP_URL, '_blank')}
                className="active:scale-[0.98] transition-transform"
              >
                Quiero empezar mi asesoramiento
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => handleScrollTo('planes')}
                className="active:scale-[0.98] transition-transform"
              >
                Ver planes
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-12 fade-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Cómo funciona
            </h2>
            <p className="text-slate-400 text-base">
              Un proceso claro desde el primer día, con seguimiento real semana a semana.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map(({ number, icon: Icon, title, desc }, i) => (
              <div
                key={number}
                className="fade-up relative bg-[#111118] border border-white/[0.06] rounded-2xl p-6 hover:border-accent/25 transition-colors duration-200 overflow-hidden"
                style={{ transitionDelay: `${i * 0.06}s` }}
              >
                <span className="absolute right-3 top-2 text-7xl font-black text-white/[0.025] select-none leading-none pointer-events-none">
                  {number}
                </span>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent text-white text-xs font-bold mb-4 shadow-glow">
                  {number}
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Icon size={19} className="text-accent" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUIÉN SOY / MI HISTORIA ── */}
      <section className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">

          {/* Bloque superior: foto + texto introductorio */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start mb-10">

            {/* ── COLUMNA VISUAL — carousel premium ── */}
            <div className="flex justify-center lg:justify-start">
              <div className="w-full max-w-[380px] lg:max-w-[420px] xl:max-w-[430px] flex flex-col gap-2.5">

                {/* Galería con autoplay al entrar en viewport */}
                <QuienSoyCarousel />

                {/* Badge — debajo del carousel para que las fotos respiren */}
                <div className="w-full bg-[#111118]/90 backdrop-blur-sm border border-accent/25 rounded-2xl px-4 py-3.5 shadow-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Target size={14} className="text-accent" />
                    </div>
                    <div>
                      <div className="text-accent text-[10px] font-semibold tracking-widest uppercase mb-1">
                        De la inseguridad al método
                      </div>
                      <div className="text-white text-sm font-medium leading-snug">
                        El cambio empieza cuando dejás de improvisar
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <div className="w-full bg-[#111118]/80 backdrop-blur-sm border border-accent/25 rounded-2xl px-4 py-3 shadow-lg">
                  <p className="text-slate-300 text-sm font-medium leading-relaxed italic">
                    "Si alguna vez sentiste que no sabías por dónde empezar, te entiendo. Yo también estuve ahí."
                  </p>
                </div>

              </div>
            </div>

            {/* Texto introductorio */}
            <div className="fade-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mb-6">
                <User size={12} />
                De la inseguridad al método
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-7 leading-tight">
                Yo también empecé sin saber qué hacer
              </h2>

              <div className="flex flex-col gap-4 text-slate-400 text-sm leading-relaxed">
                <p>
                  Durante mucho tiempo tuve una relación difícil con mi cuerpo. Me costaba verme al espejo y en verano sacarme la remera era algo que evitaba. No era solo una cuestión física: también afectaba mi confianza, mi forma de moverme y cómo me sentía conmigo mismo.
                </p>
                <p>
                  Cuando empecé a entrenar, tampoco tenía todo claro. No sabía cómo organizar una rutina, qué comer, cuándo ajustar o si realmente estaba progresando. Probé cosas al azar, cambié de rutina demasiadas veces, comí sin entender si eso me acercaba o me alejaba de mi objetivo, y muchas veces intenté hacer todo al extremo.
                </p>
                <p>
                  Con el tiempo entendí algo que me cambió la cabeza: no se trata de hacer todo perfecto, sino de ser constante. Todos los días dejás un granito de arena y, a la larga, eso se convierte en un desierto.
                </p>
                <p>
                  Hoy el entrenamiento me dio seguridad, disciplina y una mentalidad distinta. Por eso empecé a ayudar a otros. Primero fueron amigos, después personas que me preguntaban qué hacía, y ahí entendí que podía acompañar procesos desde un lugar real: no desde la teoría perfecta, sino desde haber pasado por lo mismo.
                </p>
                <p>
                  No vendo soluciones mágicas. Te ayudo a entrenar con sentido, comer con organización y avanzar con un método claro, sin improvisar ni castigarte.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: User,
                title: 'Pasé por el proceso',
                desc: 'Sé lo que es sentirse incómodo con el propio cuerpo y no saber cómo cambiarlo.',
              },
              {
                icon: Target,
                title: 'Aprendí a ordenar el camino',
                desc: 'Entrenamiento, comida, constancia y ajustes tienen que trabajar juntos.',
              },
              {
                icon: CheckCircle,
                title: 'No vendo humo',
                desc: 'No prometo cambios mágicos. Te acompaño con estructura, datos y seguimiento real.',
              },
              {
                icon: TrendingUp,
                title: 'Busco tu mejor versión',
                desc: 'Tanto si recién empezás como si ya entrenás y querés llegar a tu máximo nivel.',
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="fade-up bg-[#111118] border border-white/[0.06] rounded-xl p-4 hover:border-accent/20 transition-colors duration-200"
                style={{ transitionDelay: `${i * 0.06}s` }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-accent" />
                  </div>
                  <span className="text-white font-semibold text-sm">{title}</span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-12 fade-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Resultados que se construyen con seguimiento
            </h2>
            <p className="text-slate-400 text-base">
              Cada proceso es distinto, pero todos tienen algo en común: estructura, constancia y ajustes según datos reales.
            </p>
          </div>

          <TestimonialsCarousel />
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-14 fade-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Planes de asesoramiento
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              No es una suscripción. Es un acompañamiento real, con estructura y seguimiento semana a semana.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan, i) => (
              <div
                key={plan.name}
                className={`fade-up relative flex flex-col rounded-3xl p-8 border transition-colors duration-200 ${
                  plan.highlight
                    ? 'bg-accent/[0.07] border-accent/35 hover:border-accent/50'
                    : 'bg-[#111118] border-white/[0.07] hover:border-white/15'
                }`}
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent text-white text-xs font-semibold shadow-glow whitespace-nowrap">
                      <Star size={11} fill="currentColor" />
                      Más completo
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-white font-bold text-lg mb-1.5">{plan.name}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{plan.description}</p>
                </div>

                <div className="mb-7 pb-7 border-b border-white/[0.06]">
                  <span className="text-5xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-2">{plan.currency}</span>
                </div>

                <div className="flex flex-col gap-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-300 text-sm">{f}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={plan.highlight ? 'primary' : 'secondary'}
                  size="lg"
                  iconRight={ArrowRight}
                  className="w-full justify-center active:scale-[0.98] transition-transform"
                  onClick={() => window.open(WHATSAPP_URL, '_blank')}
                >
                  Quiero este plan
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="border-t border-white/[0.05] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="fade-up relative bg-gradient-to-br from-accent/[0.12] via-accent/[0.04] to-transparent border border-accent/25 rounded-3xl p-10 sm:p-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(108,99,255,0.10)_0%,transparent_65%)] pointer-events-none" />
            <div className="relative w-14 h-14 rounded-2xl bg-accent/20 border border-accent/20 flex items-center justify-center mx-auto mb-6 shadow-glow">
              <Target size={26} className="text-accent" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Empezá con un plan claro, medible y adaptado a vos
            </h2>
            <p className="text-slate-400 max-w-md mx-auto text-base leading-relaxed mb-8">
              Completás el formulario inicial, definimos tus objetivos y empezamos a trabajar con estructura semana a semana.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                iconRight={ArrowRight}
                onClick={() => window.open(WHATSAPP_URL, '_blank')}
                className="active:scale-[0.98] transition-transform"
              >
                Quiero empezar
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/login')}
                className="active:scale-[0.98] transition-transform"
              >
                Ya soy alumno
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.05] py-8 text-center mb-20 md:mb-0">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Asesoramiento Fitness</span>
        </div>
        <p className="text-slate-600 text-xs">
          Entrenamiento, alimentación y seguimiento adaptado a tus objetivos.
        </p>
      </footer>

    </div>
  )
}

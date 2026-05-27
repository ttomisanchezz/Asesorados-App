import { useState, useEffect } from 'react'
import { Search, UserPlus, Users } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import ClientCard from '../components/ui/ClientCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClients } from '../services/clientService'

const FILTERS = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'active' },
  { label: 'Pausados', value: 'paused' },
  { label: 'Finalizados', value: 'finished' },
]

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    getClients()
      .then(({ data }) => setClients(data ?? []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [])

  const activeCount = clients.filter((c) => c.status === 'active').length

  const filtered = clients.filter((c) => {
    const term = search.toLowerCase()
    const matchSearch =
      (c.name ?? '').toLowerCase().includes(term) ||
      (c.objective ?? '').toLowerCase().includes(term)
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <Layout>
      <PageHeader
        title="Asesorados"
        subtitle={loading ? 'Cargando...' : `${activeCount} activos · ${clients.length} total`}
      >
        <Button icon={UserPlus} size="sm">
          Agregar asesorado
        </Button>
      </PageHeader>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre u objetivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#111118] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                filter === f.value
                  ? 'bg-accent/15 text-accent border border-accent/25'
                  : 'bg-[#111118] text-slate-400 border border-white/[0.06] hover:text-white hover:border-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading ? (
        <PageLoader label="Cargando asesorados..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={clients.length === 0 ? 'No hay asesorados todavía' : 'No se encontraron asesorados'}
          description={
            clients.length === 0
              ? 'Agregá tu primer asesorado para empezar.'
              : 'Intentá con otro término o cambiá el filtro.'
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </Layout>
  )
}

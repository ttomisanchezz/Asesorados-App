import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import Landing      from '../pages/Landing'
import Login        from '../pages/Login'
import MiPanel      from '../pages/MiPanel'
import MiNutricion  from '../pages/MiNutricion'
import MiRutina     from '../pages/MiRutina'
import MisCheckins  from '../pages/MisCheckins'
import MiProgreso   from '../pages/MiProgreso'
import Dashboard    from '../pages/Dashboard'
import Clients      from '../pages/Clients'
import ClientDetail from '../pages/ClientDetail'
import Nutrition    from '../pages/Nutrition'
import Training     from '../pages/Training'
import Checkins     from '../pages/Checkins'
import Progress     from '../pages/Progress'
import Settings     from '../pages/Settings'

const coachRoutes = (element) => (
  <ProtectedRoute requiredRole="coach">{element}</ProtectedRoute>
)
const clientRoutes = (element) => (
  <ProtectedRoute requiredRole="client">{element}</ProtectedRoute>
)
const authRequired = (element) => (
  <ProtectedRoute>{element}</ProtectedRoute>
)

export const router = createBrowserRouter([
  // Públicas
  { path: '/',      element: <Landing /> },
  { path: '/login', element: <Login /> },

  // Asesorado — requiere rol 'client'
  { path: '/mi-panel',              element: clientRoutes(<MiPanel />) },
  { path: '/mi-panel/nutricion',    element: clientRoutes(<MiNutricion />) },
  { path: '/mi-panel/rutina',       element: clientRoutes(<MiRutina />) },
  { path: '/mi-panel/check-ins',    element: clientRoutes(<MisCheckins />) },
  { path: '/mi-panel/progreso',     element: clientRoutes(<MiProgreso />) },

  // Coach/admin — requiere rol 'coach'
  { path: '/dashboard',      element: coachRoutes(<Dashboard />) },
  { path: '/clients',        element: coachRoutes(<Clients />) },
  { path: '/clients/:id',    element: coachRoutes(<ClientDetail />) },
  { path: '/nutrition',      element: coachRoutes(<Nutrition />) },
  { path: '/training',       element: coachRoutes(<Training />) },
  { path: '/checkins',       element: coachRoutes(<Checkins />) },
  { path: '/progress',       element: coachRoutes(<Progress />) },
  { path: '/settings',       element: authRequired(<Settings />) },
])

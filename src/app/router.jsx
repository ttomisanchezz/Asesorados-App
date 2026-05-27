import { createBrowserRouter } from 'react-router-dom'
import Landing from '../pages/Landing'
import Dashboard from '../pages/Dashboard'
import Clients from '../pages/Clients'
import ClientDetail from '../pages/ClientDetail'
import Nutrition from '../pages/Nutrition'
import Training from '../pages/Training'
import Checkins from '../pages/Checkins'
import Progress from '../pages/Progress'
import Settings from '../pages/Settings'

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/clients', element: <Clients /> },
  { path: '/clients/:id', element: <ClientDetail /> },
  { path: '/nutrition', element: <Nutrition /> },
  { path: '/training', element: <Training /> },
  { path: '/checkins', element: <Checkins /> },
  { path: '/progress', element: <Progress /> },
  { path: '/settings', element: <Settings /> },
])

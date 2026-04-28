import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Slideshow from './pages/Slideshow'
import Browse from './pages/Browse'
import Admin from './pages/Admin'
import Map from './pages/Map'
import NavBar from './components/NavBar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000 },
  },
})

// NavBar is hidden on the slideshow so it fills the screen cleanly.
// Navigation links are available in the slideshow's tap overlay instead.
function AppShell() {
  const location = useLocation()
  const showNav = location.pathname !== '/'

  return (
    <>
      <Routes>
        <Route path="/"       element={<Slideshow />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/map"    element={<Map />} />
        <Route path="/admin"  element={<Admin />} />
      </Routes>
      {showNav && <NavBar />}
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

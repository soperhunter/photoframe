import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Slideshow from './pages/Slideshow'
import Admin from './pages/Admin'
import Map from './pages/Map'
import NavBar from './components/NavBar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/"      element={<Slideshow />} />
          <Route path="/map"   element={<Map />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        <NavBar />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

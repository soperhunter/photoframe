import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Slideshow from './pages/Slideshow'
import Admin from './pages/Admin'

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
          <Route path="/"       element={<Slideshow />} />
          <Route path="/admin"  element={<Admin />} />
          {/* /map and /browse added in Phase 3 */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

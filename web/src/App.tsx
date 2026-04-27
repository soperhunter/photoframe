import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Slideshow from './pages/Slideshow'

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
          <Route path="/" element={<Slideshow />} />
          {/* /map, /browse, /admin added in Phase 2–3 */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

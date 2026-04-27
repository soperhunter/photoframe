import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import type { Photo } from '../types'

const INTERVAL_MS = 12_000
const PRELOAD_AHEAD = 2

async function fetchSlideshow(): Promise<Photo[]> {
  // Prefer favorites; fall back to all photos if none are marked
  const favRes = await fetch('/api/photos?favorite=true&limit=200')
  if (!favRes.ok) throw new Error('Failed to fetch photos')
  const favs: Photo[] = await favRes.json()
  if (favs.length > 0) return favs

  const allRes = await fetch('/api/photos?limit=200')
  if (!allRes.ok) throw new Error('Failed to fetch photos')
  return allRes.json()
}

export default function Slideshow() {
  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: ['slideshow'],
    queryFn: fetchSlideshow,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // re-check every 5 min for new favorites
  })

  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (photos.length < 2) return
    const t = setInterval(() => setIndex(i => (i + 1) % photos.length), INTERVAL_MS)
    return () => clearInterval(t)
  }, [photos.length])

  useEffect(() => { setIndex(0) }, [photos.length])

  // Preload next N images while current one is showing
  useEffect(() => {
    if (!photos.length) return
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const next = photos[(index + i) % photos.length]
      if (next) new Image().src = next.thumb_url
    }
  }, [index, photos])

  if (isLoading) return (
    <div className="w-full h-full bg-bg-deep flex items-center justify-center">
      <p className="font-fraunces text-text-ivory/30 text-2xl tracking-wide">Loading…</p>
    </div>
  )

  if (isError) return (
    <div className="w-full h-full bg-bg-deep flex items-center justify-center">
      <p className="font-fraunces text-text-ivory/30 text-2xl tracking-wide">Could not load photos.</p>
    </div>
  )

  if (!photos.length) return (
    <div className="w-full h-full bg-bg-deep flex flex-col items-center justify-center gap-3">
      <p className="font-fraunces text-accent-honey text-3xl tracking-wide">Photo Frame</p>
      <p className="font-inter text-text-ivory/30 text-sm">
        Upload photos and mark them as favorites in the admin.
      </p>
    </div>
  )

  const photo = photos[index]

  return (
    <div className="w-full h-full bg-bg-deep relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={photo.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center p-8"
        >
          <img
            src={photo.thumb_url}
            alt={photo.caption ?? ''}
            className="max-w-full max-h-full object-contain shadow-2xl ring-1 ring-bg-cream/10"
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

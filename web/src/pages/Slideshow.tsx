import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'

interface Photo {
  url: string
  filename: string
}

async function fetchPhotos(): Promise<Photo[]> {
  const res = await fetch('/api/photos/dev')
  if (!res.ok) throw new Error('Failed to fetch photos')
  return res.json()
}

const INTERVAL_MS = 8_000

export default function Slideshow() {
  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: ['photos-dev'],
    queryFn: fetchPhotos,
    staleTime: 60_000,
  })

  const [index, setIndex] = useState(0)

  // Advance slide every 8 seconds
  useEffect(() => {
    if (photos.length < 2) return
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % photos.length)
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [photos.length])

  // Reset index if photo list changes
  useEffect(() => {
    setIndex(0)
  }, [photos.length])

  if (isLoading) {
    return (
      <div className="w-full h-full bg-bg-deep flex items-center justify-center">
        <p className="font-fraunces text-text-ivory/30 text-2xl tracking-wide">
          Loading…
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="w-full h-full bg-bg-deep flex items-center justify-center">
        <p className="font-fraunces text-text-ivory/30 text-2xl tracking-wide">
          Could not load photos.
        </p>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="w-full h-full bg-bg-deep flex flex-col items-center justify-center gap-3">
        <p className="font-fraunces text-accent-honey text-3xl tracking-wide">
          Photo Frame
        </p>
        <p className="font-inter text-text-ivory/30 text-base">
          Add photos to get started.
        </p>
      </div>
    )
  }

  const photo = photos[index]

  return (
    <div className="w-full h-full bg-bg-deep relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={photo.url}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center p-8"
        >
          <img
            src={photo.url}
            alt=""
            className="max-w-full max-h-full object-contain shadow-2xl
                       ring-1 ring-bg-cream/10"
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

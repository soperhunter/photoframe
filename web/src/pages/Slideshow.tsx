import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import type { Photo, SlideshowState } from '../types'

const PRELOAD_AHEAD = 2

async function fetchSlideshowPhotos(): Promise<Photo[]> {
  const res = await fetch('/api/slideshow/photos')
  if (!res.ok) throw new Error('Failed to fetch photos')
  return res.json()
}

async function fetchSlideshowState(): Promise<SlideshowState> {
  const res = await fetch('/api/slideshow/state')
  if (!res.ok) throw new Error('Failed to fetch state')
  return res.json()
}

export default function Slideshow() {
  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: ['slideshow'],
    queryFn: fetchSlideshowPhotos,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  const { data: state } = useQuery({
    queryKey: ['slideshow-state'],
    queryFn: fetchSlideshowState,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const intervalMs = (state?.interval_seconds ?? 12) * 1000
  const showCaptions = state?.show_captions ?? true
  const showDates    = state?.show_dates    ?? true

  const [index, setIndex] = useState(0)

  // Shuffle once when photos load
  const [shuffled, setShuffled] = useState<Photo[]>([])
  useEffect(() => {
    if (!photos.length) return
    const arr = [...photos]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffled(arr)
    setIndex(0)
  }, [photos.length])

  // Advance every intervalMs
  useEffect(() => {
    if (shuffled.length < 2) return
    const t = setInterval(() => setIndex(i => (i + 1) % shuffled.length), intervalMs)
    return () => clearInterval(t)
  }, [shuffled.length, intervalMs])

  // Preload next N images
  useEffect(() => {
    if (!shuffled.length) return
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const next = shuffled[(index + i) % shuffled.length]
      if (next) new Image().src = next.thumb_url
    }
  }, [index, shuffled])

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

  if (!shuffled.length) return (
    <div className="w-full h-full bg-bg-deep flex flex-col items-center justify-center gap-3">
      <p className="font-fraunces text-accent-honey text-3xl tracking-wide">Photo Frame</p>
      <p className="font-inter text-text-ivory/30 text-sm">
        Upload photos and mark them as favorites in the admin.
      </p>
    </div>
  )

  const photo = shuffled[index]

  const dateLabel = (showDates && photo.taken_at)
    ? new Date(photo.taken_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const captionText = showCaptions ? photo.caption : null
  const hasOverlay  = !!(captionText || dateLabel)

  return (
    <div className="w-full h-full bg-bg-deep relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={photo.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* Photo */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <img
              src={photo.thumb_url}
              alt={photo.caption ?? ''}
              className="max-w-full max-h-full object-contain shadow-2xl ring-1 ring-bg-cream/10"
              draggable={false}
            />
          </div>

          {/* Caption + date overlay */}
          {hasOverlay && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-10 pt-16 pb-8 flex flex-col items-center gap-1">
              {captionText && (
                <p className="font-inter text-text-ivory/90 text-lg text-center leading-snug drop-shadow-lg max-w-2xl">
                  {captionText}
                </p>
              )}
              {dateLabel && (
                <p className="font-fraunces text-accent-honey text-3xl tracking-wide drop-shadow-lg">
                  {dateLabel}
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

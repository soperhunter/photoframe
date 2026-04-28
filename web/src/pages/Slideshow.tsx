import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
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
  const [overlayVisible, setOverlayVisible] = useState(false)
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  // Incrementing this key resets the auto-advance interval (e.g. after manual nav)
  const [timerKey, setTimerKey] = useState(0)
  const queryClient = useQueryClient()

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

  // Auto-advance — resets when timerKey changes (manual navigation)
  useEffect(() => {
    if (shuffled.length < 2) return
    const t = setInterval(() => setIndex(i => (i + 1) % shuffled.length), intervalMs)
    return () => clearInterval(t)
  }, [shuffled.length, intervalMs, timerKey])

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

  function showOverlay() {
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
    setOverlayVisible(true)
    overlayTimer.current = setTimeout(() => setOverlayVisible(false), 5000)
  }

  function dismissOverlay() {
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
    setOverlayVisible(false)
  }

  function handleTap() {
    if (overlayVisible) {
      dismissOverlay()
    } else {
      showOverlay()
    }
  }

  function goNext() {
    setIndex(i => (i + 1) % shuffled.length)
    setTimerKey(k => k + 1)
    // Keep overlay visible, refresh its auto-dismiss timer
    showOverlay()
  }

  function goPrev() {
    setIndex(i => (i - 1 + shuffled.length) % shuffled.length)
    setTimerKey(k => k + 1)
    showOverlay()
  }

  async function hidePhoto() {
    const photo = shuffled[index]
    if (!photo) return
    dismissOverlay()

    // Remove from local array immediately so slideshow continues
    setShuffled(prev => {
      const next = prev.filter(p => p.id !== photo.id)
      setIndex(i => Math.min(i, next.length - 1))
      return next
    })

    // Persist — use apiFetch so credentials/headers are consistent
    const res = await apiFetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: true }),
    })

    if (res.ok) {
      // Invalidate both so the library grid and slideshow both update
      queryClient.invalidateQueries({ queryKey: ['slideshow'] })
      queryClient.invalidateQueries({ queryKey: ['admin-photos'] })
    }
  }

  const photo = shuffled[index]

  const dateLabel = (showDates && photo.taken_at)
    ? new Date(photo.taken_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const captionText = showCaptions ? photo.caption : null
  const hasOverlay  = !!(captionText || dateLabel)

  return (
    <div className="fixed inset-0 bg-bg-deep" onClick={handleTap}>
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-10 pt-16 pb-16 flex flex-col items-center gap-1">
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

      {/* Tap overlay — nav + prev / hide / next */}
      <AnimatePresence>
        {overlayVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Top row — section nav + dismiss */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                {[
                  { icon: '⊞', label: 'Browse', to: '/browse' },
                  { icon: '◎', label: 'Map',    to: '/map'    },
                  { icon: '⚙', label: 'Manage', to: '/admin'  },
                ].map(({ icon, label, to }) => (
                  <button
                    key={to}
                    onClick={() => navigate(to)}
                    className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white/70 font-inter text-sm px-3 py-1.5 rounded-full border border-white/15 hover:text-white transition-colors"
                  >
                    <span className="text-xs">{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={dismissOverlay}
                className="bg-black/40 backdrop-blur text-white/50 font-inter text-xs px-3 py-1.5 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom row — prev / hide / next */}
            <div className="flex items-center justify-center gap-3 px-6 pb-8">
              <button
                onClick={goPrev}
                className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white font-inter text-sm font-medium px-5 py-3 rounded-full border border-white/20 active:scale-95 transition-transform"
              >
                ‹ Prev
              </button>

              <button
                onClick={hidePhoto}
                className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white/80 font-inter text-sm px-5 py-3 rounded-full border border-white/20 hover:bg-red-900/60 active:scale-95 transition-all"
              >
                🚫 Hide
              </button>

              <button
                onClick={goNext}
                className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white font-inter text-sm font-medium px-5 py-3 rounded-full border border-white/20 active:scale-95 transition-transform"
              >
                Next ›
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

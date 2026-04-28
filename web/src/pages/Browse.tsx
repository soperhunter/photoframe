import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import type { Collection, Photo } from '../types'

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0,
    transition: { duration: 0.18, ease: 'easeIn' },
  }),
}

function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: Photo[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const [dir, setDir] = useState(0)
  const photo = photos[index]

  // Preload neighbours
  useEffect(() => {
    [-1, 1, 2].forEach(offset => {
      const p = photos[index + offset]
      if (p) new Image().src = p.full_url
    })
  }, [index, photos])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function goNext() {
    if (index >= photos.length - 1) return
    setDir(1)
    onNavigate(index + 1)
  }

  function goPrev() {
    if (index <= 0) return
    setDir(-1)
    onNavigate(index - 1)
  }

  const taken = photo.taken_at
    ? new Date(photo.taken_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const hasInfo = !!(photo.caption || taken || photo.location_name)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-inter text-white/40 text-sm">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-lg hover:bg-white/20 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Photo area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="wait">
          <motion.div
            key={photo.id}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -400) goNext()
              else if (info.offset.x > 60 || info.velocity.x > 400) goPrev()
            }}
            className="absolute inset-0 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
          >
            <img
              src={photo.full_url}
              alt={photo.caption ?? ''}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Prev arrow */}
        {index > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-0 inset-y-0 w-16 flex items-center justify-start pl-3 bg-gradient-to-r from-black/30 to-transparent text-white/50 text-4xl hover:text-white/90 transition-colors"
          >
            ‹
          </button>
        )}

        {/* Next arrow */}
        {index < photos.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-0 inset-y-0 w-16 flex items-center justify-end pr-3 bg-gradient-to-l from-black/30 to-transparent text-white/50 text-4xl hover:text-white/90 transition-colors"
          >
            ›
          </button>
        )}
      </div>

      {/* Caption / date / location */}
      {hasInfo && (
        <div className="flex-shrink-0 px-6 py-4 pb-6 flex flex-col gap-1">
          {photo.caption && (
            <p className="font-inter text-white/90 text-base leading-snug">{photo.caption}</p>
          )}
          {taken && (
            <p className="font-fraunces text-accent-honey text-xl tracking-wide">{taken}</p>
          )}
          {photo.location_name && (
            <p className="font-inter text-white/40 text-sm">📍 {photo.location_name}</p>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Browse page ──────────────────────────────────────────────────────────────

export default function Browse() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [activeAlbumId, setActiveAlbumId] = useState<number | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  const { data: allPhotos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ['browse-photos'],
    queryFn: async () => {
      const res = await fetch('/api/photos?limit=1000')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 2 * 60_000,
  })

  const { data: albums = [] } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await fetch('/api/collections')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 60_000,
  })

  // Filter by album if one is selected
  const photos = activeAlbumId === null
    ? allPhotos
    : allPhotos.filter(p => p.collections.some(c => c.id === activeAlbumId))

  return (
    <div className="absolute inset-0 bottom-14 flex flex-col bg-bg-deep">

      {/* Album filter strip */}
      {albums.length > 0 && (
        <div
          ref={filterRef}
          className="flex-shrink-0 flex gap-2 overflow-x-auto px-3 py-2.5 bg-bg-deep/95 border-b border-white/5 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => setActiveAlbumId(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full font-inter text-sm transition-colors
              ${activeAlbumId === null
                ? 'bg-accent-amber text-text-ivory'
                : 'bg-white/10 text-text-ivory/50 hover:bg-white/15'}`}
          >
            All
          </button>
          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => setActiveAlbumId(album.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full font-inter text-sm transition-colors
                ${activeAlbumId === album.id
                  ? 'bg-accent-amber text-text-ivory'
                  : 'bg-white/10 text-text-ivory/50 hover:bg-white/15'}`}
            >
              {album.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-fraunces text-text-ivory/30 text-xl">Loading…</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="font-fraunces text-text-ivory/60 text-2xl">No photos here</p>
            <p className="font-inter text-text-ivory/30 text-sm">
              {activeAlbumId !== null
                ? 'Add photos to this album from the Manage tab.'
                : 'Upload photos from the Manage tab to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-px bg-black/40">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                onClick={() => setLightboxIndex(i)}
                className="aspect-square overflow-hidden bg-black/20 relative group"
              >
                <img
                  src={photo.thumb_url}
                  alt={photo.caption ?? ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                {/* Subtle caption hint */}
                {photo.caption && (
                  <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            photos={photos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

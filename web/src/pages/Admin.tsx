import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import type { Collection, Photo, PhotoUpdate, SlideshowState, SlideshowStateUpdate } from '../types'

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UploadZone({ onDone }: { onDone: (count: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ done: number; total: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  async function uploadFiles(files: File[]) {
    const images = files.filter(f => f.type.startsWith('image/'))
    if (!images.length) return
    setStatus({ done: 0, total: images.length })
    for (let i = 0; i < images.length; i++) {
      const fd = new FormData()
      fd.append('file', images[i])
      await apiFetch('/api/photos', { method: 'POST', body: fd })
      setStatus({ done: i + 1, total: images.length })
    }
    const count = images.length
    setStatus(null)
    onDone(count)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer
        ${dragging ? 'border-accent-amber bg-accent-amber/10' : 'border-text-espresso/20 hover:border-accent-amber/50'}`}
      onClick={() => !status && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => uploadFiles(Array.from(e.target.files ?? []))} />
      {status ? (
        <>
          <p className="font-inter text-text-espresso font-medium">
            Uploading {status.done} / {status.total}…
          </p>
          <div className="mt-3 h-2 bg-text-espresso/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-amber rounded-full transition-all"
              style={{ width: `${(status.done / status.total) * 100}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <p className="font-inter text-text-espresso/60 text-sm">Tap to pick photos — or drag & drop</p>
          <p className="font-inter text-text-espresso/40 text-xs mt-1">JPG, PNG, WEBP · multiple files OK</p>
        </>
      )}
    </div>
  )
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────

function PhotoGrid({
  photos, onSelect, selectMode, selectedIds, onToggle,
}: {
  photos: Photo[]
  onSelect: (p: Photo) => void
  selectMode: boolean
  selectedIds: Set<number>
  onToggle: (id: number) => void
}) {
  if (!photos.length) return (
    <p className="font-inter text-text-espresso/40 text-sm text-center py-12">
      No photos yet — upload some above.
    </p>
  )

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
      {photos.map(photo => {
        const selected = selectedIds.has(photo.id)
        return (
          <button
            key={photo.id}
            onClick={() => selectMode ? onToggle(photo.id) : onSelect(photo)}
            className={`relative aspect-square overflow-hidden rounded-lg bg-text-espresso/5 group
              ${selectMode && selected ? 'ring-2 ring-accent-amber ring-offset-1' : ''}`}
          >
            <img src={photo.thumb_url} alt={photo.caption ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />

            {/* Hidden overlay */}
            {photo.is_hidden && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                <span className="text-white/80 text-xl">🚫</span>
              </div>
            )}

            {selectMode ? (
              <div className={`absolute inset-0 flex items-center justify-center transition-colors
                ${selected ? 'bg-accent-amber/30' : 'bg-transparent'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                  ${selected ? 'bg-accent-amber border-accent-amber' : 'border-white/70 bg-black/20'}`}>
                  {selected && <span className="text-white text-xs leading-none">✓</span>}
                </div>
              </div>
            ) : (
              !photo.is_hidden && photo.is_favorite && (
                <span className="absolute top-1 right-1 text-accent-cranberry text-sm drop-shadow">♥</span>
              )
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Location Picker ──────────────────────────────────────────────────────────

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

function LocationModal({
  count, onApply, onClose,
}: {
  count: number
  onApply: (lat: number, lon: number, name: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [locationName, setLocationName] = useState('')
  const [applying, setApplying] = useState(false)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function pickResult(r: NominatimResult) {
    setLat(parseFloat(r.lat).toFixed(6))
    setLon(parseFloat(r.lon).toFixed(6))
    const parts = r.display_name.split(', ')
    setLocationName(parts.slice(0, 3).join(', '))
    setResults([])
    setQuery(parts[0])
  }

  async function apply() {
    const parsedLat = parseFloat(lat)
    const parsedLon = parseFloat(lon)
    if (isNaN(parsedLat) || isNaN(parsedLon)) return
    setApplying(true)
    await onApply(parsedLat, parsedLon, locationName)
    setApplying(false)
  }

  const ready = lat.trim() !== '' && lon.trim() !== '' && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[10000]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[10001] bg-bg-cream rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-fraunces text-text-espresso text-lg">Set Location</h2>
            <button onClick={onClose} className="text-text-espresso/40 text-xl">✕</button>
          </div>
          <p className="font-inter text-text-espresso/50 text-sm">
            Applying to <strong>{count}</strong> photo{count !== 1 ? 's' : ''}
          </p>

          <div>
            <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Search a place</label>
            <div className="mt-1 flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="e.g. Central Park, New York"
                className="flex-1 border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
              />
              <button
                onClick={search}
                disabled={searching || !query.trim()}
                className="bg-accent-amber text-text-ivory rounded-xl px-4 py-2.5 font-inter text-sm font-medium disabled:opacity-50"
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-text-espresso/10 overflow-hidden">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickResult(r)}
                  className="text-left px-4 py-2.5 bg-white hover:bg-accent-amber/10 transition-colors border-b border-text-espresso/5 last:border-0"
                >
                  <p className="font-inter text-text-espresso text-sm truncate">{r.display_name}</p>
                  <p className="font-inter text-text-espresso/40 text-xs mt-0.5">{parseFloat(r.lat).toFixed(4)}, {parseFloat(r.lon).toFixed(4)}</p>
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Coordinates</label>
            <div className="mt-1 flex gap-2">
              <input
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="Latitude"
                inputMode="decimal"
                className="flex-1 border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
              />
              <input
                value={lon}
                onChange={e => setLon(e.target.value)}
                placeholder="Longitude"
                inputMode="decimal"
                className="flex-1 border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
              />
            </div>
          </div>

          <div>
            <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Place name (optional)</label>
            <input
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              placeholder="e.g. Central Park"
              className="mt-1 w-full border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
            />
          </div>
        </div>

        <div className="flex-shrink-0 px-4 py-3 border-t border-text-espresso/10 bg-bg-cream">
          {!ready && (
            <p className="font-inter text-text-espresso/40 text-xs text-center mb-2">
              Search for a place or enter coordinates above
            </p>
          )}
          <button
            onClick={apply}
            disabled={!ready || applying}
            className="w-full bg-accent-amber text-text-ivory rounded-xl py-3.5 font-inter font-medium text-base disabled:opacity-40 transition-opacity"
          >
            {applying
              ? '⏳ Applying…'
              : ready
                ? `✓ Apply to ${count} photo${count !== 1 ? 's' : ''}`
                : `Apply to ${count} photo${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Album Picker Modal ───────────────────────────────────────────────────────

function AlbumPickerModal({
  count, albums: initialAlbums, onApply, onClose,
}: {
  count: number
  albums: Collection[]
  onApply: (albumId: number) => Promise<void>
  onClose: () => void
}) {
  const [albums, setAlbums] = useState<Collection[]>(initialAlbums)
  const [applying, setApplying] = useState<number | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function pick(albumId: number) {
    setApplying(albumId)
    await onApply(albumId)
    setDone(prev => new Set(prev).add(albumId))
    setApplying(null)
  }

  async function createAndAdd() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await apiFetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const album: Collection = await res.json()
      setAlbums(prev => [album, ...prev])
      setNewName('')
      // Immediately add selected photos to the new album
      await pick(album.id)
    }
    setCreating(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[10000]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[10001] bg-bg-cream rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-fraunces text-text-espresso text-lg">Add to Album</h2>
            <button onClick={onClose} className="text-text-espresso/40 text-xl">✕</button>
          </div>
          <p className="font-inter text-text-espresso/50 text-sm">
            Adding <strong>{count}</strong> photo{count !== 1 ? 's' : ''} to:
          </p>

          {/* Inline album creation */}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createAndAdd()}
              placeholder="New album name…"
              className="flex-1 border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
            />
            <button
              onClick={createAndAdd}
              disabled={creating || !newName.trim()}
              className="bg-accent-amber text-text-ivory rounded-xl px-4 py-2.5 font-inter text-sm font-medium disabled:opacity-50 flex-shrink-0"
            >
              {creating ? '…' : 'Create'}
            </button>
          </div>

          {/* Existing albums */}
          {albums.length > 0 && (
            <div className="flex flex-col gap-2">
              {albums.map(album => {
                const isDone = done.has(album.id)
                const isApplying = applying === album.id
                return (
                  <button
                    key={album.id}
                    onClick={() => !isDone && pick(album.id)}
                    disabled={isApplying || isDone}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl border font-inter text-sm transition-colors
                      ${isDone
                        ? 'bg-accent-amber/15 border-accent-amber/40 text-text-espresso'
                        : 'bg-white border-text-espresso/15 text-text-espresso hover:border-accent-amber/40 active:bg-accent-amber/5'}`}
                  >
                    <span className="font-medium">{album.name}</span>
                    <span className="text-text-espresso/40 text-xs">
                      {isDone ? '✓ Added' : isApplying ? '…' : `${album.photo_count} photo${album.photo_count !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 py-3 border-t border-text-espresso/10 bg-bg-cream">
          <button
            onClick={onClose}
            className="w-full bg-text-espresso/10 text-text-espresso rounded-xl py-3 font-inter font-medium text-sm"
          >
            {done.size > 0 ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Photo Modal ──────────────────────────────────────────────────────────────

function PhotoModal({
  photo, albums, index, total, onClose, onSaved, onDeleted, onPrev, onNext,
}: {
  photo: Photo
  albums: Collection[]
  index: number
  total: number
  onClose: () => void
  onSaved: (p: Photo) => void
  onDeleted: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite)
  const [isHidden, setIsHidden] = useState(photo.is_hidden)
  const [lat, setLat] = useState(photo.latitude?.toString() ?? '')
  const [lon, setLon] = useState(photo.longitude?.toString() ?? '')
  const [selectedAlbums, setSelectedAlbums] = useState<number[]>(
    photo.collections?.map((c: { id: number; name: string }) => c.id) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    const parsedLat = lat.trim() !== '' ? parseFloat(lat) : null
    const parsedLon = lon.trim() !== '' ? parseFloat(lon) : null
    const body: PhotoUpdate = {
      caption,
      is_favorite: isFavorite,
      is_hidden: isHidden,
      latitude: parsedLat,
      longitude: parsedLon,
      collection_ids: selectedAlbums,
    }
    const res = await apiFetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) onSaved(await res.json())
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Delete this photo?')) return
    setDeleting(true)
    await apiFetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
    onDeleted()
  }

  function toggleAlbum(id: number) {
    setSelectedAlbums(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const taken = photo.taken_at
    ? new Date(photo.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative bg-bg-cream rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Photo with prev/next overlaid */}
        <div className="relative bg-text-espresso flex-shrink-0">
          <img
            src={photo.thumb_url}
            alt={photo.caption ?? ''}
            className="w-full object-cover max-h-64"
          />

          {/* Prev button */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-0 inset-y-0 w-14 flex items-center justify-start pl-2 bg-gradient-to-r from-black/40 to-transparent text-white text-2xl hover:from-black/60 transition-colors"
            >
              ‹
            </button>
          )}

          {/* Next button */}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-0 inset-y-0 w-14 flex items-center justify-end pr-2 bg-gradient-to-l from-black/40 to-transparent text-white text-2xl hover:from-black/60 transition-colors"
            >
              ›
            </button>
          )}

          {/* Counter + close */}
          <div className="absolute top-2 inset-x-0 flex items-center justify-between px-3">
            <span className="bg-black/50 text-white/80 font-inter text-xs px-2.5 py-1 rounded-full">
              {index + 1} / {total}
            </span>
            <button
              onClick={onClose}
              className="bg-black/50 text-white/80 w-7 h-7 rounded-full flex items-center justify-center text-sm hover:bg-black/70 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Date overlay at bottom of photo */}
          {taken && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <p className="font-fraunces text-white/90 text-sm">{taken}</p>
              <p className="font-inter text-white/50 text-xs truncate">{photo.original_name}</p>
            </div>
          )}
        </div>

        {/* Scrollable fields */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">

          {/* Favorite + Hidden */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsFavorite(f => !f)}
              className={`flex-1 flex items-center justify-center gap-2 font-inter text-sm font-medium rounded-xl px-4 py-2.5 transition-colors
                ${isFavorite ? 'bg-accent-cranberry text-text-ivory' : 'bg-text-espresso/10 text-text-espresso'}`}
            >
              <span>{isFavorite ? '♥' : '♡'}</span>
              {isFavorite ? 'Favorited' : 'Favorite'}
            </button>
            <button
              onClick={() => setIsHidden(h => !h)}
              className={`flex items-center justify-center gap-2 font-inter text-sm font-medium rounded-xl px-4 py-2.5 transition-colors
                ${isHidden ? 'bg-text-espresso text-text-ivory' : 'bg-text-espresso/10 text-text-espresso/60'}`}
            >
              <span>{isHidden ? '🚫' : '👁'}</span>
              {isHidden ? 'Hidden' : 'Visible'}
            </button>
          </div>

          {/* Caption */}
          <div>
            <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Caption</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={2}
              placeholder="Add a caption…"
              className="mt-1 w-full border border-text-espresso/20 rounded-lg px-3 py-2 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber resize-none bg-white"
            />
          </div>

          {/* Albums */}
          {albums.length > 0 && (
            <div>
              <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Albums</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {albums.map(album => (
                  <button
                    key={album.id}
                    onClick={() => toggleAlbum(album.id)}
                    className={`px-3 py-1 rounded-full text-xs font-inter font-medium transition-colors
                      ${selectedAlbums.includes(album.id) ? 'bg-accent-amber text-text-ivory' : 'bg-text-espresso/10 text-text-espresso'}`}
                  >
                    {album.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Location (lat, lon)</label>
            <div className="mt-1 flex gap-2">
              <input
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="Latitude"
                inputMode="decimal"
                className="flex-1 border border-text-espresso/20 rounded-lg px-3 py-2 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
              />
              <input
                value={lon}
                onChange={e => setLon(e.target.value)}
                placeholder="Longitude"
                inputMode="decimal"
                className="flex-1 border border-text-espresso/20 rounded-lg px-3 py-2 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
              />
            </div>
            <p className="font-inter text-text-espresso/30 text-xs mt-1">
              e.g. 40.7128, -74.0060 — saves to map
            </p>
          </div>
        </div>

        {/* Sticky Save / Delete */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-text-espresso/10 bg-bg-cream flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-accent-amber text-text-ivory rounded-xl py-3 font-inter font-medium disabled:opacity-50"
          >
            {saving ? '⏳ Saving…' : '✓ Save'}
          </button>
          <button
            onClick={remove}
            disabled={deleting}
            className="bg-text-espresso/10 text-accent-cranberry rounded-xl px-4 py-3 font-inter font-medium disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0
        ${value ? 'bg-accent-amber' : 'bg-text-espresso/20'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
          ${value ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </button>
  )
}

function SettingRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-text-espresso/8 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-inter text-text-espresso text-sm font-medium">{label}</p>
        {description && <p className="font-inter text-text-espresso/40 text-xs mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

const INTERVALS = [
  { label: '5s',  value: 5 },
  { label: '8s',  value: 8 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1m',  value: 60 },
]

function SettingsTab({ state, onStateChange }: {
  state: SlideshowState | undefined
  onStateChange: () => void
}) {
  const [saving, setSaving] = useState<string | null>(null)

  async function update(patch: SlideshowStateUpdate, key: string) {
    setSaving(key)
    await apiFetch('/api/slideshow/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    onStateChange()
    setSaving(null)
  }

  if (!state) return (
    <p className="font-inter text-text-espresso/40 text-sm text-center py-12">Loading…</p>
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider mb-2">
          Default slideshow content
        </p>
        <p className="font-inter text-text-espresso/50 text-xs mb-3">
          Shown when no album is active
        </p>
        <div className="flex rounded-xl overflow-hidden border border-text-espresso/15">
          {(['favorites', 'all'] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => update({ fallback_filter: f }, 'filter')}
              className={`flex-1 py-2.5 font-inter text-sm transition-colors
                ${i === 0 ? '' : 'border-l border-text-espresso/15'}
                ${state.fallback_filter === f
                  ? 'bg-accent-amber text-text-ivory font-medium'
                  : 'bg-white text-text-espresso/60 hover:bg-accent-amber/8'}`}
            >
              {f === 'favorites' ? '♥ Favorites only' : '⊞ All photos'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider mb-3">
          Time per photo
        </p>
        <div className="flex gap-2">
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => update({ interval_seconds: value }, 'interval')}
              disabled={saving === 'interval'}
              className={`flex-1 py-2.5 rounded-xl font-inter text-sm font-medium transition-colors border
                ${state.interval_seconds === value
                  ? 'bg-accent-amber text-text-ivory border-accent-amber'
                  : 'bg-white text-text-espresso/60 border-text-espresso/15 hover:border-accent-amber/40'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-text-espresso/10 px-4">
        <SettingRow label="Shuffle" description="Randomise photo order each cycle">
          <Toggle value={state.shuffle} onChange={v => update({ shuffle: v }, 'shuffle')} />
        </SettingRow>
        <SettingRow label="Show captions" description="Display caption text over photos">
          <Toggle value={state.show_captions} onChange={v => update({ show_captions: v }, 'captions')} />
        </SettingRow>
        <SettingRow label="Show dates" description="Display photo date over photos">
          <Toggle value={state.show_dates} onChange={v => update({ show_dates: v }, 'dates')} />
        </SettingRow>
      </div>
    </div>
  )
}

// ─── Albums Tab ───────────────────────────────────────────────────────────────

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: '1 hour',  hours: 1 },
  { label: '1 day',   hours: 24 },
  { label: '1 week',  hours: 24 * 7 },
  { label: 'Forever', hours: null },
]

function AlbumsTab({ slideshowState, onStateChange }: {
  slideshowState: SlideshowState | undefined
  onStateChange: () => void
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [activating, setActivating] = useState<number | null>(null)

  const { data: albums = [], refetch } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await apiFetch('/api/collections')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  async function createAlbum() {
    if (!newName.trim()) return
    setCreating(true)
    await apiFetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setNewName('')
    setCreating(false)
    refetch()
  }

  async function activate(albumId: number, hours: number | null) {
    setActivating(albumId)
    const expires_at = hours
      ? new Date(Date.now() + hours * 3600 * 1000).toISOString()
      : null
    const body: SlideshowStateUpdate = { active_collection_id: albumId, expires_at }
    await apiFetch('/api/slideshow/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setActivating(null)
    onStateChange()
  }

  async function deactivate() {
    await apiFetch('/api/slideshow/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_collection: true }),
    })
    onStateChange()
  }

  async function deleteAlbum(id: number) {
    if (!confirm('Delete this album?')) return
    await apiFetch(`/api/collections/${id}`, { method: 'DELETE' })
    if (slideshowState?.active_collection_id === id) await deactivate()
    refetch()
    onStateChange()
  }

  const activeId = slideshowState?.is_collection_active
    ? slideshowState.active_collection_id
    : null

  return (
    <div className="flex flex-col gap-5">
      {/* Active now banner */}
      {slideshowState?.is_collection_active && (
        <div className="bg-accent-amber/15 border border-accent-amber/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-inter text-text-espresso text-sm font-medium">
              Now playing: <span className="text-accent-amber">{slideshowState.active_collection_name}</span>
            </p>
            {slideshowState.expires_at && (
              <p className="font-inter text-text-espresso/50 text-xs mt-0.5">
                Until {new Date(slideshowState.expires_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={deactivate}
            className="font-inter text-text-espresso/50 text-xs border border-text-espresso/20 rounded-lg px-3 py-1.5"
          >
            Deactivate
          </button>
        </div>
      )}

      {/* Create */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createAlbum()}
          placeholder="New album name…"
          className="flex-1 border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
        />
        <button
          onClick={createAlbum}
          disabled={creating || !newName.trim()}
          className="bg-accent-amber text-text-ivory rounded-xl px-4 py-2.5 font-inter text-sm font-medium disabled:opacity-50"
        >
          Create
        </button>
      </div>

      {/* Album list */}
      {albums.length === 0 ? (
        <p className="font-inter text-text-espresso/40 text-sm text-center py-8">
          No albums yet. Create one above, then add photos from the Library tab.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {albums.map(album => {
            const isActive = album.id === activeId
            return (
              <div
                key={album.id}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isActive ? 'border-accent-amber/40 bg-accent-amber/8' : 'border-text-espresso/10 bg-white'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-text-espresso font-medium text-sm flex items-center gap-2">
                    {album.name}
                    {isActive && (
                      <span className="bg-accent-amber text-text-ivory text-xs px-2 py-0.5 rounded-full font-normal">Active</span>
                    )}
                  </p>
                  <p className="font-inter text-text-espresso/40 text-xs mt-0.5">{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}</p>
                </div>

                {!isActive && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    {DURATIONS.map(d => (
                      <button
                        key={d.label}
                        onClick={() => activate(album.id, d.hours)}
                        disabled={activating === album.id}
                        className="font-inter text-xs text-accent-amber border border-accent-amber/40 rounded-lg px-2 py-1 hover:bg-accent-amber/10 transition-colors disabled:opacity-50"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => deleteAlbum(album.id)}
                  className="text-text-espresso/30 hover:text-accent-cranberry transition-colors text-lg leading-none flex-shrink-0"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Admin Root ───────────────────────────────────────────────────────────────

type Tab = 'library' | 'albums' | 'settings'

export default function Admin() {
  const [loggedIn] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('library')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const { data: photos = [], refetch: refetchPhotos } = useQuery<Photo[]>({
    queryKey: ['admin-photos'],
    queryFn: async () => {
      const res = await apiFetch('/api/photos?limit=500')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: loggedIn,
  })

  const { data: albums = [], refetch: refetchAlbums } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await apiFetch('/api/collections')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: loggedIn,
  })

  const { data: slideshowState, refetch: refetchState } = useQuery<SlideshowState>({
    queryKey: ['slideshow-state'],
    queryFn: async () => {
      const res = await apiFetch('/api/slideshow/state')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: loggedIn,
  })

  function handleUploaded(count: number) {
    refetchPhotos()
    queryClient.invalidateQueries({ queryKey: ['slideshow'] })
    setToast(`✓ ${count} photo${count !== 1 ? 's' : ''} uploaded`)
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function applyBulkLocation(lat: number, lon: number, name: string) {
    const res = await apiFetch('/api/photos/bulk-location', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_ids: Array.from(selectedIds),
        latitude: lat,
        longitude: lon,
        location_name: name || null,
      }),
    })
    if (!res.ok) {
      setToast('❌ Failed to set location — please try again')
      return
    }
    setShowLocationModal(false)
    setToast(`📍 Location set on ${selectedIds.size} photo${selectedIds.size !== 1 ? 's' : ''}`)
    exitSelectMode()
    refetchPhotos()
    queryClient.invalidateQueries({ queryKey: ['photos-gps'] })
  }

  async function applyBulkAlbum(albumId: number) {
    const res = await apiFetch(`/api/collections/${albumId}/photos/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: Array.from(selectedIds) }),
    })
    if (!res.ok) {
      setToast('❌ Failed to add to album')
      return
    }
    refetchAlbums()
    refetchPhotos()
    queryClient.invalidateQueries({ queryKey: ['slideshow'] })
  }

  return (
    <div className="min-h-screen bg-bg-cream overflow-y-auto">
      <header className="sticky top-0 z-30 bg-bg-cream/90 backdrop-blur border-b border-text-espresso/10 px-4 py-3">
        <h1 className="font-fraunces text-text-espresso text-lg">Manage</h1>
      </header>

      <div className="sticky top-[53px] z-20 bg-bg-cream/90 backdrop-blur border-b border-text-espresso/10 px-4 flex gap-0">
        {([['library', 'Library'], ['albums', 'Albums'], ['settings', 'Settings']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`font-inter text-sm px-4 py-2.5 border-b-2 transition-colors ${
              tab === key
                ? 'border-accent-amber text-text-espresso font-medium'
                : 'border-transparent text-text-espresso/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-text-espresso text-text-ivory text-sm font-inter px-5 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6 pb-24">
        {tab === 'library' && (
          <>
            {!selectMode && <UploadZone onDone={handleUploaded} />}
            <div className="flex items-center justify-between">
              <h2 className="font-fraunces text-text-espresso text-base">
                Library <span className="font-inter text-text-espresso/40 text-sm font-normal">({photos.length})</span>
              </h2>
              {selectMode ? (
                <div className="flex items-center gap-3">
                  <span className="font-inter text-text-espresso/50 text-xs">{selectedIds.size} selected</span>
                  <button onClick={exitSelectMode} className="font-inter text-text-espresso/50 text-xs border border-text-espresso/20 rounded-lg px-3 py-1">Done</button>
                </div>
              ) : (
                <button onClick={() => setSelectMode(true)} className="font-inter text-accent-amber text-xs font-medium">
                  Select
                </button>
              )}
            </div>
            <PhotoGrid
              photos={photos}
              onSelect={p => setSelectedIndex(photos.findIndex(x => x.id === p.id))}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          </>
        )}

        {tab === 'albums' && (
          <AlbumsTab
            slideshowState={slideshowState}
            onStateChange={() => {
              refetchState()
              queryClient.invalidateQueries({ queryKey: ['slideshow'] })
              queryClient.invalidateQueries({ queryKey: ['slideshow-state'] })
            }}
          />
        )}

        {tab === 'settings' && (
          <SettingsTab
            state={slideshowState}
            onStateChange={() => {
              refetchState()
              queryClient.invalidateQueries({ queryKey: ['slideshow'] })
              queryClient.invalidateQueries({ queryKey: ['slideshow-state'] })
            }}
          />
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-14 inset-x-0 z-40 bg-bg-cream border-t border-text-espresso/10 px-4 py-3 flex items-center gap-2 shadow-lg">
          <span className="font-inter text-text-espresso text-sm flex-1">
            {selectedIds.size} photo{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSelectedIds(new Set(photos.map(p => p.id)))}
            className="font-inter text-text-espresso/50 text-xs"
          >
            All
          </button>
          <button
            onClick={() => setShowAlbumModal(true)}
            className="bg-text-espresso/10 text-text-espresso font-inter text-sm font-medium px-4 py-2 rounded-xl"
          >
            + Album
          </button>
          <button
            onClick={() => setShowLocationModal(true)}
            className="bg-accent-amber text-text-ivory font-inter text-sm font-medium px-4 py-2 rounded-xl"
          >
            📍 Location
          </button>
        </div>
      )}

      {showLocationModal && (
        <LocationModal
          count={selectedIds.size}
          onApply={applyBulkLocation}
          onClose={() => setShowLocationModal(false)}
        />
      )}

      {showAlbumModal && (
        <AlbumPickerModal
          count={selectedIds.size}
          albums={albums}
          onApply={applyBulkAlbum}
          onClose={() => {
            setShowAlbumModal(false)
            setToast(`✓ Photos added to album`)
            exitSelectMode()
          }}
        />
      )}

      {selectedIndex !== null && photos[selectedIndex] && (
        <PhotoModal
          key={photos[selectedIndex].id}
          photo={photos[selectedIndex]}
          albums={albums}
          index={selectedIndex}
          total={photos.length}
          onClose={() => setSelectedIndex(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedIndex(i => i! - 1) : undefined}
          onNext={selectedIndex < photos.length - 1 ? () => setSelectedIndex(i => i! + 1) : undefined}
          onSaved={updated => {
            refetchPhotos()
            queryClient.invalidateQueries({ queryKey: ['slideshow'] })
            // Stay on same index — photo list will refresh around it
          }}
          onDeleted={() => {
            setSelectedIndex(null)
            refetchPhotos()
            queryClient.invalidateQueries({ queryKey: ['slideshow'] })
          }}
        />
      )}
    </div>
  )
}

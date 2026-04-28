import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import type { Collection, Photo, PhotoUpdate, SlideshowState, SlideshowStateUpdate, Tag } from '../types'

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

function PhotoGrid({ photos, onSelect }: { photos: Photo[]; onSelect: (p: Photo) => void }) {
  if (!photos.length) return (
    <p className="font-inter text-text-espresso/40 text-sm text-center py-12">
      No photos yet — upload some above.
    </p>
  )

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
      {photos.map(photo => (
        <button
          key={photo.id}
          onClick={() => onSelect(photo)}
          className="relative aspect-square overflow-hidden rounded-lg bg-text-espresso/5 group"
        >
          <img src={photo.thumb_url} alt={photo.caption ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
          {photo.is_favorite && (
            <span className="absolute top-1 right-1 text-accent-cranberry text-sm drop-shadow">♥</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Photo Drawer ─────────────────────────────────────────────────────────────

function PhotoDrawer({
  photo, tags, collections, onClose, onSaved, onDeleted,
}: {
  photo: Photo
  tags: Tag[]
  collections: Collection[]
  onClose: () => void
  onSaved: (p: Photo) => void
  onDeleted: () => void
}) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite)
  const [selectedTags, setSelectedTags] = useState<number[]>(photo.tags.map(t => t.id))
  const [selectedCollections, setSelectedCollections] = useState<number[]>(
    photo.collections?.map((c: { id: number; name: string }) => c.id) ?? []
  )
  const [newTagName, setNewTagName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    const body: PhotoUpdate = {
      caption,
      is_favorite: isFavorite,
      tag_ids: selectedTags,
      collection_ids: selectedCollections,
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

  async function createTag() {
    if (!newTagName.trim()) return
    const res = await apiFetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName.trim() }),
    })
    if (res.ok) {
      const tag: Tag = await res.json()
      setSelectedTags(prev => [...prev, tag.id])
      setNewTagName('')
    }
  }

  function toggleTag(id: number) {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleCollection(id: number) {
    setSelectedCollections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const taken = photo.taken_at ? new Date(photo.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-bg-cream rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-inter text-text-espresso/50 text-xs truncate">{photo.original_name}</p>
              {taken && <p className="font-fraunces text-text-espresso text-sm">{taken}</p>}
            </div>
            <button onClick={onClose} className="text-text-espresso/40 text-xl leading-none flex-shrink-0">✕</button>
          </div>

          <img src={photo.thumb_url} alt="" className="w-full rounded-xl object-cover max-h-48" />

          {/* Favorite */}
          <button
            onClick={() => setIsFavorite(f => !f)}
            className={`flex items-center gap-2 font-inter text-sm font-medium rounded-xl px-4 py-2.5 transition-colors
              ${isFavorite ? 'bg-accent-cranberry text-text-ivory' : 'bg-text-espresso/10 text-text-espresso'}`}
          >
            <span>{isFavorite ? '♥' : '♡'}</span>
            {isFavorite ? 'Remove from slideshow' : 'Add to slideshow'}
          </button>

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

          {/* Collections */}
          {collections.length > 0 && (
            <div>
              <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Collections</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => toggleCollection(col.id)}
                    className={`px-3 py-1 rounded-full text-xs font-inter font-medium transition-colors
                      ${selectedCollections.includes(col.id) ? 'bg-accent-amber text-text-ivory' : 'bg-text-espresso/10 text-text-espresso'}`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="font-inter text-text-espresso/60 text-xs uppercase tracking-wider">Tags</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs font-inter font-medium transition-colors
                    ${selectedTags.includes(tag.id) ? 'bg-accent-amber text-text-ivory' : 'bg-text-espresso/10 text-text-espresso'}`}
                >
                  {tag.name}
                </button>
              ))}
              <div className="flex gap-1">
                <input
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createTag()}
                  placeholder="New tag…"
                  className="border border-text-espresso/20 rounded-full px-3 py-1 text-xs font-inter text-text-espresso outline-none focus:ring-2 focus:ring-accent-amber bg-white w-24"
                />
                <button onClick={createTag} className="bg-accent-amber text-text-ivory rounded-full px-2 py-1 text-xs font-inter">+</button>
              </div>
            </div>
          </div>

          {/* GPS */}
          {(photo.latitude || photo.longitude) && (
            <p className="font-inter text-text-espresso/40 text-xs">
              📍 {photo.latitude?.toFixed(4)}, {photo.longitude?.toFixed(4)}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-safe">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-accent-amber text-text-ivory rounded-xl py-3 font-inter font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
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
    </>
  )
}

// ─── Collections Tab ──────────────────────────────────────────────────────────

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: '1 hour',  hours: 1 },
  { label: '1 day',   hours: 24 },
  { label: '1 week',  hours: 24 * 7 },
  { label: 'Forever', hours: null },
]

function CollectionsTab({ slideshowState, onStateChange }: {
  slideshowState: SlideshowState | undefined
  onStateChange: () => void
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [activating, setActivating] = useState<number | null>(null)

  const { data: collections = [], refetch } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await apiFetch('/api/collections')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  async function createCollection() {
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

  async function activate(collectionId: number, hours: number | null) {
    setActivating(collectionId)
    const expires_at = hours
      ? new Date(Date.now() + hours * 3600 * 1000).toISOString()
      : null
    const body: SlideshowStateUpdate = { active_collection_id: collectionId, expires_at }
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

  async function deleteCollection(id: number) {
    if (!confirm('Delete this collection?')) return
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
          onKeyDown={e => e.key === 'Enter' && createCollection()}
          placeholder="New collection name…"
          className="flex-1 border border-text-espresso/20 rounded-xl px-4 py-2.5 font-inter text-text-espresso text-sm outline-none focus:ring-2 focus:ring-accent-amber bg-white"
        />
        <button
          onClick={createCollection}
          disabled={creating || !newName.trim()}
          className="bg-accent-amber text-text-ivory rounded-xl px-4 py-2.5 font-inter text-sm font-medium disabled:opacity-50"
        >
          Create
        </button>
      </div>

      {/* Collection list */}
      {collections.length === 0 ? (
        <p className="font-inter text-text-espresso/40 text-sm text-center py-8">
          No collections yet. Create one above, then add photos from the Library tab.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map(col => {
            const isActive = col.id === activeId
            return (
              <div
                key={col.id}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isActive ? 'border-accent-amber/40 bg-accent-amber/8' : 'border-text-espresso/10 bg-white'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-text-espresso font-medium text-sm flex items-center gap-2">
                    {col.name}
                    {isActive && (
                      <span className="bg-accent-amber text-text-ivory text-xs px-2 py-0.5 rounded-full font-normal">Active</span>
                    )}
                  </p>
                  <p className="font-inter text-text-espresso/40 text-xs mt-0.5">{col.photo_count} photo{col.photo_count !== 1 ? 's' : ''}</p>
                </div>

                {/* Activate buttons */}
                {!isActive && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    {DURATIONS.map(d => (
                      <button
                        key={d.label}
                        onClick={() => activate(col.id, d.hours)}
                        disabled={activating === col.id}
                        className="font-inter text-xs text-accent-amber border border-accent-amber/40 rounded-lg px-2 py-1 hover:bg-accent-amber/10 transition-colors disabled:opacity-50"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => deleteCollection(col.id)}
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

type Tab = 'library' | 'collections'

export default function Admin() {
  // TODO: restore login gate before gifting (set AUTH_DISABLED=false in .env)
  const [loggedIn, setLoggedIn] = useState(true)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('library')
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

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await apiFetch('/api/tags')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: loggedIn,
  })

  const { data: collections = [] } = useQuery<Collection[]>({
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

  // Login gate disabled for dev — see loggedIn useState above
  // if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />

  return (
    <div className="min-h-screen bg-bg-cream overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-cream/90 backdrop-blur border-b border-text-espresso/10 px-4 py-3">
        <h1 className="font-fraunces text-text-espresso text-lg">Manage</h1>
      </header>

      {/* Tab bar */}
      <div className="sticky top-[53px] z-20 bg-bg-cream/90 backdrop-blur border-b border-text-espresso/10 px-4 flex gap-0">
        {([['library', 'Library'], ['collections', 'Collections']] as [Tab, string][]).map(([key, label]) => (
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-text-espresso text-text-ivory text-sm font-inter px-5 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6 pb-24">
        {tab === 'library' && (
          <>
            <UploadZone onDone={handleUploaded} />
            <div className="flex items-center justify-between">
              <h2 className="font-fraunces text-text-espresso text-base">
                Library <span className="font-inter text-text-espresso/40 text-sm font-normal">({photos.length})</span>
              </h2>
              <p className="font-inter text-text-espresso/40 text-xs">Tap a photo to edit or favorite it</p>
            </div>
            <PhotoGrid photos={photos} onSelect={setSelected} />
          </>
        )}

        {tab === 'collections' && (
          <CollectionsTab
            slideshowState={slideshowState}
            onStateChange={() => {
              refetchState()
              queryClient.invalidateQueries({ queryKey: ['slideshow'] })
              queryClient.invalidateQueries({ queryKey: ['slideshow-state'] })
            }}
          />
        )}
      </div>

      {selected && (
        <PhotoDrawer
          photo={selected}
          tags={tags}
          collections={collections}
          onClose={() => setSelected(null)}
          onSaved={updated => {
            setSelected(updated)
            refetchPhotos()
            queryClient.invalidateQueries({ queryKey: ['slideshow'] })
          }}
          onDeleted={() => {
            setSelected(null)
            refetchPhotos()
            queryClient.invalidateQueries({ queryKey: ['slideshow'] })
          }}
        />
      )}
    </div>
  )
}

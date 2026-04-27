import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, clearAuth, hasAuth, setAuth } from '../api/client'
import type { Photo, PhotoUpdate, Tag } from '../types'

// ─── Login Gate ─────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setAuth(user, pass)
    const res = await apiFetch('/api/tags')
    if (res.ok) {
      onLogin()
    } else {
      clearAuth()
      setError(true)
    }
  }

  return (
    <div className="min-h-screen bg-bg-cream flex items-center justify-center p-6">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm flex flex-col gap-4">
        <h1 className="font-fraunces text-text-espresso text-2xl text-center">Photo Frame</h1>
        <p className="font-inter text-text-espresso/60 text-sm text-center">Admin</p>
        {error && <p className="text-accent-cranberry text-sm text-center font-inter">Incorrect credentials.</p>}
        <input
          className="border border-text-espresso/20 rounded-lg px-4 py-2.5 font-inter text-text-espresso outline-none focus:ring-2 focus:ring-accent-amber"
          placeholder="Username" value={user} onChange={e => setUser(e.target.value)} autoComplete="username"
        />
        <input
          type="password"
          className="border border-text-espresso/20 rounded-lg px-4 py-2.5 font-inter text-text-espresso outline-none focus:ring-2 focus:ring-accent-amber"
          placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password"
        />
        <button type="submit" className="bg-accent-amber text-text-ivory rounded-lg py-2.5 font-inter font-medium hover:opacity-90 active:opacity-75 transition-opacity">
          Sign in
        </button>
      </form>
    </div>
  )
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UploadZone({ onDone }: { onDone: () => void }) {
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
    setStatus(null)
    onDone()
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
  photo, tags, onClose, onSaved, onDeleted,
}: {
  photo: Photo
  tags: Tag[]
  onClose: () => void
  onSaved: (p: Photo) => void
  onDeleted: () => void
}) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite)
  const [selectedTags, setSelectedTags] = useState<number[]>(photo.tags.map(t => t.id))
  const [newTagName, setNewTagName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    const body: PhotoUpdate = { caption, is_favorite: isFavorite, tag_ids: selectedTags }
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

  const taken = photo.taken_at ? new Date(photo.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
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

          {/* Thumbnail */}
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

// ─── Admin Root ───────────────────────────────────────────────────────────────

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(hasAuth())
  const [selected, setSelected] = useState<Photo | null>(null)
  const queryClient = useQueryClient()

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

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />

  return (
    <div className="min-h-screen bg-bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-cream/90 backdrop-blur border-b border-text-espresso/10 px-4 py-3 flex items-center justify-between">
        <h1 className="font-fraunces text-text-espresso text-lg">Photo Frame</h1>
        <button
          onClick={() => { clearAuth(); setLoggedIn(false) }}
          className="font-inter text-text-espresso/40 text-sm"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        <UploadZone onDone={() => { refetchPhotos(); queryClient.invalidateQueries({ queryKey: ['slideshow'] }) }} />
        <PhotoGrid photos={photos} onSelect={setSelected} />
      </div>

      {selected && (
        <PhotoDrawer
          photo={selected}
          tags={tags}
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

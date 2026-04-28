import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import type { Collection, Photo } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhotoGroup {
  id: string
  name: string
  photos: Photo[]
  position: [number, number]
  isAlbum: boolean
}

// ── Marker icons ──────────────────────────────────────────────────────────────

const MARKER_W = 148

function albumMarkerIcon(name: string, count: number) {
  // Truncate long names so the fixed-width pill doesn't overflow
  const label = name.length > 18 ? name.slice(0, 16) + '…' : name
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${MARKER_W}px;
      background:#F5ECDD;
      border:2.5px solid #C8741A;
      border-radius:10px;
      padding:6px 10px;
      box-shadow:0 3px 10px rgba(0,0,0,0.35);
      text-align:center;
    ">
      <div style="color:#3A2418;font-family:Inter,sans-serif;font-size:12px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
      <div style="color:#C8741A;font-family:Inter,sans-serif;font-size:10px;font-weight:500;margin-top:1px">${count} photo${count !== 1 ? 's' : ''}</div>
    </div>`,
    iconSize: [MARKER_W, 44],
    iconAnchor: [MARKER_W / 2, 22],  // centered on the coordinate
  })
}

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:12px;height:12px;
    background:#E5B547;
    border:2px solid #8B2E2A;
    border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,0.45);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount()
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;
      background:#C8741A;border:2px solid #E5B547;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      color:#F4EAD7;font-family:Inter,sans-serif;font-size:12px;font-weight:600;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

// ── Fit bounds ────────────────────────────────────────────────────────────────

function FitBounds({ groups }: { groups: PhotoGroup[] }) {
  const map = useMap()
  useEffect(() => {
    if (!groups.length) return
    const bounds = L.latLngBounds(groups.map(g => g.position))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
  }, [groups.length, map])
  return null
}

// ── Photo group viewer (tall bottom sheet) ────────────────────────────────────

function GroupViewer({
  group, onClose,
}: {
  group: PhotoGroup
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const photo = group.photos[index]
  const total = group.photos.length

  useEffect(() => setIndex(0), [group.id])

  // Preload neighbours
  useEffect(() => {
    [-1, 1].forEach(offset => {
      const p = group.photos[index + offset]
      if (p) new Image().src = p.display_url
    })
  }, [index, group.photos])

  const taken = photo.taken_at
    ? new Date(photo.taken_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <>
      {/* Tap backdrop to close */}
      <div className="fixed inset-0 z-[1001]" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-14 z-[1002] bg-bg-deep rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '48vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/8">
          <div className="min-w-0">
            <p className="font-fraunces text-text-ivory text-base leading-tight truncate">{group.name}</p>
            {total > 1 && (
              <p className="font-inter text-text-ivory/40 text-xs mt-0.5">{index + 1} of {total}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-text-ivory/60 hover:bg-white/20 transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Photo — fills available space */}
        <div className="flex-1 relative bg-black overflow-hidden min-h-0">
          <img
            key={photo.id}
            src={photo.display_url}
            alt={photo.caption ?? ''}
            className="w-full h-full object-contain"
          />

          {/* Prev arrow */}
          {index > 0 && (
            <button
              onClick={() => setIndex(i => i - 1)}
              className="absolute left-0 inset-y-0 w-14 flex items-center justify-start pl-2 bg-gradient-to-r from-black/40 to-transparent text-white text-3xl hover:from-black/60 transition-colors"
            >
              ‹
            </button>
          )}

          {/* Next arrow */}
          {index < total - 1 && (
            <button
              onClick={() => setIndex(i => i + 1)}
              className="absolute right-0 inset-y-0 w-14 flex items-center justify-end pr-2 bg-gradient-to-l from-black/40 to-transparent text-white text-3xl hover:from-black/60 transition-colors"
            >
              ›
            </button>
          )}
        </div>

        {/* Footer — date, caption, location */}
        {(taken || photo.caption || photo.location_name) && (
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-white/8 flex flex-col gap-0.5">
            {taken && (
              <p className="font-fraunces text-accent-honey text-sm">{taken}</p>
            )}
            {photo.caption && (
              <p className="font-inter text-text-ivory/70 text-xs leading-snug line-clamp-1">{photo.caption}</p>
            )}
            {photo.location_name && (
              <p className="font-inter text-text-ivory/35 text-xs truncate">📍 {photo.location_name}</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Map page ──────────────────────────────────────────────────────────────────

export default function Map() {
  const [selectedGroup, setSelectedGroup] = useState<PhotoGroup | null>(null)

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ['photos-gps'],
    queryFn: async () => {
      const res = await fetch('/api/photos?has_gps=true&limit=1000')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })

  const { data: albums = [] } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await fetch('/api/collections')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })

  const geoPhotos = photos.filter(p => p.latitude != null && p.longitude != null)

  // One marker per album that has GPS photos
  const albumGroups: PhotoGroup[] = albums
    .map(album => {
      const albumPhotos = geoPhotos.filter(p =>
        p.collections.some(c => c.id === album.id)
      )
      if (!albumPhotos.length) return null
      const lat = albumPhotos.reduce((s, p) => s + p.latitude!, 0) / albumPhotos.length
      const lng = albumPhotos.reduce((s, p) => s + p.longitude!, 0) / albumPhotos.length
      return {
        id: `album-${album.id}`,
        name: album.name,
        photos: albumPhotos,
        position: [lat, lng] as [number, number],
        isAlbum: true,
      }
    })
    .filter((g): g is PhotoGroup => g !== null)

  // Photos not in any album — individual markers (still clustered)
  const albumPhotoIds = new Set(albumGroups.flatMap(g => g.photos.map(p => p.id)))
  const ungroupedPhotos = geoPhotos.filter(p => !albumPhotoIds.has(p.id))

  const ungroupedGroups: PhotoGroup[] = ungroupedPhotos.map(photo => ({
    id: `photo-${photo.id}`,
    name: photo.location_name ?? photo.original_name,
    photos: [photo],
    position: [photo.latitude!, photo.longitude!] as [number, number],
    isAlbum: false,
  }))

  const allGroups = [...albumGroups, ...ungroupedGroups]

  return (
    <div className="absolute inset-0 bottom-14">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-cream">
          <p className="font-fraunces text-text-espresso/40 text-xl">Loading map…</p>
        </div>
      )}

      {!isLoading && geoPhotos.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg-cream px-8 text-center">
          <p className="font-fraunces text-text-espresso text-2xl">No locations yet</p>
          <p className="font-inter text-text-espresso/50 text-sm leading-relaxed">
            Photos with GPS coordinates will appear here.<br />
            Go to <strong>Manage → Library</strong>, tap any photo, and enter coordinates under Location.
          </p>
        </div>
      )}

      <MapContainer
        center={[39.83, -98.58]}
        zoom={4}
        zoomControl={true}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {/* Album markers — one pill per album */}
        {albumGroups.map(group => (
          <Marker
            key={group.id}
            position={group.position}
            icon={albumMarkerIcon(group.name, group.photos.length)}
            eventHandlers={{
              click: () => setSelectedGroup(g => g?.id === group.id ? null : group),
            }}
          />
        ))}

        {/* Ungrouped individual photo markers */}
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          chunkedLoading
          maxClusterRadius={50}
        >
          {ungroupedGroups.map(group => (
            <Marker
              key={group.id}
              position={group.position}
              icon={pinIcon}
              eventHandlers={{
                click: () => setSelectedGroup(g => g?.id === group.id ? null : group),
              }}
            />
          ))}
        </MarkerClusterGroup>

        {allGroups.length > 0 && <FitBounds groups={allGroups} />}
      </MapContainer>

      {/* Fixed photo viewer panel */}
      {selectedGroup && (
        <GroupViewer
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  )
}

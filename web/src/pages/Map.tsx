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

function albumMarkerIcon(name: string, count: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#C8741A;
      border:2px solid #E5B547;
      border-radius:20px;
      padding:5px 12px;
      white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
      display:flex;flex-direction:column;align-items:center;gap:1px;
    ">
      <span style="color:#F4EAD7;font-family:Inter,sans-serif;font-size:12px;font-weight:600;line-height:1.2">${name}</span>
      <span style="color:#F4EAD7;font-family:Inter,sans-serif;font-size:10px;opacity:0.7;line-height:1">${count} photo${count !== 1 ? 's' : ''}</span>
    </div>`,
    iconAnchor: [0, 0],
    popupAnchor: [0, 0],
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

// ── Photo group viewer (fixed bottom panel) ───────────────────────────────────

function GroupViewer({
  group, onClose,
}: {
  group: PhotoGroup
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const photo = group.photos[index]
  const total = group.photos.length

  // Reset index when group changes
  useEffect(() => setIndex(0), [group.id])

  const taken = photo.taken_at
    ? new Date(photo.taken_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <>
      {/* Backdrop tap to close */}
      <div className="fixed inset-0 z-[1001]" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-14 z-[1002] bg-bg-deep/95 backdrop-blur border-t border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-stretch max-w-2xl mx-auto">

          {/* Photo thumbnail */}
          <div className="w-28 h-28 flex-shrink-0 bg-black/30">
            <img
              src={photo.display_url}
              alt={photo.caption ?? ''}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-inter text-text-ivory/50 text-xs font-medium uppercase tracking-wider truncate">
                  {group.name}
                </p>
                <button
                  onClick={onClose}
                  className="text-text-ivory/30 text-lg leading-none flex-shrink-0 hover:text-text-ivory/70 transition-colors"
                >
                  ✕
                </button>
              </div>
              {taken && (
                <p className="font-fraunces text-accent-honey text-base mt-0.5">{taken}</p>
              )}
              {photo.caption && (
                <p className="font-inter text-text-ivory/70 text-xs mt-1 line-clamp-2">{photo.caption}</p>
              )}
              {photo.location_name && (
                <p className="font-inter text-text-ivory/30 text-xs mt-0.5 truncate">📍 {photo.location_name}</p>
              )}
            </div>

            {/* Navigation */}
            {total > 1 && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setIndex(i => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="text-text-ivory/50 disabled:text-text-ivory/20 text-lg leading-none hover:text-text-ivory transition-colors"
                >
                  ‹
                </button>
                <span className="font-inter text-text-ivory/40 text-xs">
                  {index + 1} / {total}
                </span>
                <button
                  onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
                  disabled={index === total - 1}
                  className="text-text-ivory/50 disabled:text-text-ivory/20 text-lg leading-none hover:text-text-ivory transition-colors"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
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

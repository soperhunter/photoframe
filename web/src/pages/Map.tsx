import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import type { Photo } from '../types'

// ── Custom icons ──────────────────────────────────────────────────────────────

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;
    background:#E5B547;
    border:2.5px solid #8B2E2A;
    border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,0.45);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
})

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount()
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;
      background:#C8741A;
      border:2px solid #E5B547;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#F4EAD7;font-family:Inter,sans-serif;font-size:13px;font-weight:600;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

// ── Fit map to all markers ────────────────────────────────────────────────────

function FitBounds({ photos }: { photos: Photo[] }) {
  const map = useMap()
  useEffect(() => {
    if (!photos.length) return
    const bounds = L.latLngBounds(
      photos.map(p => [p.latitude!, p.longitude!] as [number, number])
    )
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
  }, [photos.length, map])
  return null
}

// ── Map page ──────────────────────────────────────────────────────────────────

export default function Map() {
  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ['photos-gps'],
    queryFn: async () => {
      const res = await fetch('/api/photos?has_gps=true&limit=500')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })

  const geoPhotos = photos.filter(p => p.latitude != null && p.longitude != null)

  return (
    <div className="w-full h-full overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-cream">
          <p className="font-fraunces text-text-espresso/40 text-xl">Loading map…</p>
        </div>
      )}

      {!isLoading && geoPhotos.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-bg-cream pb-14">
          <p className="font-fraunces text-text-espresso text-2xl">No locations yet</p>
          <p className="font-inter text-text-espresso/40 text-sm">
            Photos with GPS data will appear here. Add GPS in Manage → tap a photo.
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

        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          chunkedLoading
          maxClusterRadius={50}
        >
          {geoPhotos.map(photo => {
            const dateLabel = photo.taken_at
              ? new Date(photo.taken_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })
              : null

            return (
              <Marker
                key={photo.id}
                position={[photo.latitude!, photo.longitude!]}
                icon={pinIcon}
              >
                <Popup minWidth={160} maxWidth={220}>
                  <div style={{ fontFamily: 'Inter, sans-serif' }}>
                    <img
                      src={photo.thumb_url}
                      alt={photo.caption ?? ''}
                      style={{ width: '100%', borderRadius: 8, marginBottom: 8, display: 'block' }}
                    />
                    {dateLabel && (
                      <p style={{ color: '#C8741A', fontFamily: 'serif', fontSize: 14, margin: '0 0 4px' }}>
                        {dateLabel}
                      </p>
                    )}
                    {photo.caption && (
                      <p style={{ color: '#3A2418', fontSize: 12, margin: 0 }}>
                        {photo.caption}
                      </p>
                    )}
                    {!dateLabel && !photo.caption && (
                      <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
                        {photo.original_name}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MarkerClusterGroup>

        {geoPhotos.length > 0 && <FitBounds photos={geoPhotos} />}
      </MapContainer>
    </div>
  )
}

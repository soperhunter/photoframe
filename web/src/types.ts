export interface Photo {
  id: number
  filename: string
  original_name: string
  width: number | null
  height: number | null
  taken_at: string | null
  uploaded_at: string
  latitude: number | null
  longitude: number | null
  location_name: string | null
  caption: string | null
  is_favorite: boolean
  is_hidden: boolean
  thumb_url: string
  full_url: string
  collections: { id: number; name: string }[]
}

export interface PhotoUpdate {
  caption?: string | null
  latitude?: number | null
  longitude?: number | null
  location_name?: string | null
  is_favorite?: boolean
  is_hidden?: boolean
  collection_ids?: number[]
}

export interface Collection {
  id: number
  name: string
  description: string | null
  created_at: string
  photo_count: number
}

export interface SlideshowState {
  active_collection_id: number | null
  active_collection_name: string | null
  expires_at: string | null
  fallback_filter: 'favorites' | 'all'
  shuffle: boolean
  interval_seconds: number
  show_captions: boolean
  show_dates: boolean
  is_collection_active: boolean
}

export interface SlideshowStateUpdate {
  active_collection_id?: number | null
  expires_at?: string | null
  clear_collection?: boolean
  fallback_filter?: string
  shuffle?: boolean
  interval_seconds?: number
  show_captions?: boolean
  show_dates?: boolean
}

export interface Tag {
  id: number
  name: string
  color: string | null
}

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
  thumb_url: string
  full_url: string
  tags: Tag[]
}

export interface PhotoUpdate {
  caption?: string | null
  latitude?: number | null
  longitude?: number | null
  location_name?: string | null
  is_favorite?: boolean
  tag_ids?: number[]
}

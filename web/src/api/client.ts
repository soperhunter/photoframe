let _auth: string | null = null

export function setAuth(user: string, pass: string) {
  _auth = `Basic ${btoa(`${user}:${pass}`)}`
}

export function clearAuth() {
  _auth = null
}

export function hasAuth(): boolean {
  return _auth !== null
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> ?? {}),
  }
  if (_auth) headers['Authorization'] = _auth
  const res = await fetch(path, { ...init, headers })
  if (res.status === 401) clearAuth()
  return res
}

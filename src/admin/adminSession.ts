const ADMIN_SESSION_KEY = 'hu360_admin_ok'

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'
}

export function setAdminAuthenticated(): void {
  sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

/** Compare com `import.meta.env.VITE_ADMIN_SECRET` no `.env` local (não commitar). */
export function verifyAdminSecret(input: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_SECRET ?? ''
  if (!expected.trim()) {
    return false
  }
  return input === expected
}

export function isAdminSecretConfigured(): boolean {
  return Boolean((import.meta.env.VITE_ADMIN_SECRET ?? '').trim())
}

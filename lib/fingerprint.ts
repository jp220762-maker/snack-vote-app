export function getVoterFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr'
  const key = 'snackvote_fp'
  let fp = localStorage.getItem(key)
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, fp)
  }
  return fp
}

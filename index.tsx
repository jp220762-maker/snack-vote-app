// 簡易瀏覽器指紋，用於匿名防重複投票
// 不蒐集個資，純粹用來識別同一瀏覽器
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

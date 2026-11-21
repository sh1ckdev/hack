const KEY_SEQ = 'relay-shift-anchor-seq'
const KEY_AT = 'relay-shift-anchor-at'

export function readShiftAnchor(): { seq: number; at: string } | null {
  try {
    const seq = localStorage.getItem(KEY_SEQ)
    const at = localStorage.getItem(KEY_AT)
    if (seq == null || !at) return null
    const parsed = Number(seq)
    if (!Number.isFinite(parsed)) return null
    return { seq: parsed, at }
  } catch {
    return null
  }
}

export function writeShiftAnchor(seq: number) {
  localStorage.setItem(KEY_SEQ, String(seq))
  localStorage.setItem(KEY_AT, new Date().toISOString())
}

export function clearShiftAnchor() {
  localStorage.removeItem(KEY_SEQ)
  localStorage.removeItem(KEY_AT)
}
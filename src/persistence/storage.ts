import type { AppSnapshot } from '../domain/types'

export const STORAGE_KEY = 'nexora.snapshot.v1'
export const STORAGE_VERSION = 1

export interface StorageAdapter {
  load(): AppSnapshot | null
  save(snapshot: AppSnapshot): void
  clear(): void
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export const localStorageAdapter: StorageAdapter = {
  load() {
    if (!canUseLocalStorage()) return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as AppSnapshot
      if (!parsed || parsed.version !== STORAGE_VERSION) return null
      if (!Array.isArray(parsed.workspaces) || !Array.isArray(parsed.activities)) return null
      return {
        ...parsed,
        commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      }
    } catch {
      return null
    }
  },
  save(snapshot) {
    if (!canUseLocalStorage()) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  },
  clear() {
    if (!canUseLocalStorage()) return
    window.localStorage.removeItem(STORAGE_KEY)
  },
}

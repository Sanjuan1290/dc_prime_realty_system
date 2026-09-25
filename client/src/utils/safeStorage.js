const resolveStorage = (kind) => {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

const createSafeStorage = (kind) => ({
  getItem(key) {
    try {
      return resolveStorage(kind)?.getItem(key) ?? null
    } catch {
      return null
    }
  },

  setItem(key, value) {
    try {
      const storage = resolveStorage(kind)
      if (!storage) return false
      storage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },

  removeItem(key) {
    try {
      const storage = resolveStorage(kind)
      if (!storage) return false
      storage.removeItem(key)
      return true
    } catch {
      return false
    }
  },
})

export const safeLocalStorage = createSafeStorage('local')
export const safeSessionStorage = createSafeStorage('session')


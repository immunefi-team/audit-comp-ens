// Constants
export const TIME_UNITS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
} as const

// Utility functions
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < TIME_UNITS.MINUTE) return 'Just now'
  if (diff < TIME_UNITS.HOUR) {
    const minutes = Math.floor(diff / TIME_UNITS.MINUTE)
    return `${minutes} min ago`
  }
  if (diff < TIME_UNITS.DAY) {
    const hours = Math.floor(diff / TIME_UNITS.HOUR)
    return `${hours}h ago`
  }
  if (diff < TIME_UNITS.WEEK) {
    const days = Math.floor(diff / TIME_UNITS.DAY)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
  if (diff < TIME_UNITS.MONTH) {
    const weeks = Math.floor(diff / TIME_UNITS.WEEK)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
  if (diff < TIME_UNITS.YEAR) {
    const months = Math.floor(diff / TIME_UNITS.MONTH)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }

  const years = Math.floor(diff / TIME_UNITS.YEAR)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export const formatAbsoluteTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

export const formatExpiryTime = (
  expiryDate: number,
): { text: string; isExpired: boolean } => {
  const now = Date.now()
  const diff = expiryDate - now

  if (diff <= 0) {
    return { text: 'Expired', isExpired: true }
  }

  if (diff < TIME_UNITS.HOUR) {
    const minutes = Math.floor(diff / TIME_UNITS.MINUTE)
    return { text: `Expires in ${minutes} min`, isExpired: false }
  }

  if (diff < TIME_UNITS.DAY) {
    const hours = Math.floor(diff / TIME_UNITS.HOUR)
    return { text: `Expires in ${hours}h`, isExpired: false }
  }

  const days = Math.floor(diff / TIME_UNITS.DAY)
  return {
    text: `Expires in ${days} day${days > 1 ? 's' : ''}`,
    isExpired: false,
  }
}

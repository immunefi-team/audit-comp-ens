// Utility functions for formatting notification data
// This can be expanded with more formatting utilities as needed

export const formatNotificationTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 1) {
    return 'Just now'
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }
  return date.toLocaleDateString()
}

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}

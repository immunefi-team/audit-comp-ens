/**
 * Split a name into labels from left to right (deepest to root)
 * @param name - ENS name like "domico.eth"
 * @returns Array of labels like ["domico", "eth"]
 */
function splitLabels(name: string): string[] {
  return name.split('.')
}

/**
 * Get the labels, current label, parent label, and registrable label for a given name
 * @param name - ENS name like "domico.eth"
 * @returns Object with labels, current label, parent label, and registrable label
 */
export const getNameLabels = (name: string) => {
  const labels = splitLabels(name)
  return {
    labels,
    currentLabel: labels[0],
    parentLabel: labels[1] ?? null,
    registrableLabel:
      labels.length >= 2 ? labels[labels.length - 2] : labels[0],
  }
}

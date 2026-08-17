export const asciiEncode = (name: string) => {
  try {
    return new URL(`https://${name}`).hostname
  } catch {
    return name
  }
}

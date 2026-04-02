export function isServerOperatingSystem(osName?: string | null) {
  return Boolean(osName && osName.toLowerCase().includes('server'))
}

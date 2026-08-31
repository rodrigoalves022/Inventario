export function getTenantBasePath(clientSlug: string) {
  return `/app/${clientSlug}`
}

export function getTenantPath(clientSlug: string, segment?: string) {
  const basePath = getTenantBasePath(clientSlug)
  if (!segment) return basePath
  return `${basePath}/${segment.replace(/^\//, '')}`
}

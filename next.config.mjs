import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Fix: "Collecting build traces" hangs on Windows because Next.js
  // recursively scans node_modules. Excluding them cuts build time from
  // minutes/timeout to seconds.
  outputFileTracingRoot: __dirname,
  outputFileTracingExcludes: {
    '*': [
      './node_modules/@swc/**',
      './node_modules/sharp/**',
      './node_modules/.cache/**',
      './node_modules/webpack/**',
      './node_modules/next/dist/compiled/**',
    ],
  },
  serverExternalPackages: ['bcryptjs'],
  experimental: {
  }
}

export default nextConfig

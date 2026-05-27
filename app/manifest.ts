import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yeah Buddy',
    short_name: 'Yeah Buddy',
    description: 'Lightweight, baby. Your personal strength training tracker.',
    start_url: '/',
    display: 'standalone',
    background_color: '#18181b',
    theme_color: '#18181b',
    orientation: 'portrait',
    categories: ['fitness', 'health', 'sports'],
    icons: [
      {
        // Next.js serves the app/icon.tsx output at /icon
        src: '/icon',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}

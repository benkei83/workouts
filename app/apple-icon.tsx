import { ImageResponse } from 'next/og'
import { BarbellIcon } from './icon'

// Apple touch icon — 180×180, same design
export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(<BarbellIcon />, { ...size })
}

import { ImageResponse } from 'next/og'

export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

// SVG barbell — scales correctly at any render size (512×512 favicon, 180×180 apple-icon, etc.)
export function BarbellIcon() {
  return (
    <div
      style={{
        background: '#18181b',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '18%',
      }}
    >
      {/*
        viewBox 200×100 (2:1) — barbell fills the full width.
        SVG is rendered at 82% width / 41% height of the parent square,
        preserving the 2:1 aspect ratio at every canvas size.
      */}
      <svg
        width="82%"
        height="41%"
        viewBox="0 0 200 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left plate */}
        <rect x="0"   y="5"  width="26" height="90" rx="4" fill="#f97316" />
        {/* Left collar */}
        <rect x="26"  y="26" width="14" height="48" rx="2" fill="#71717a" />
        {/* Bar */}
        <rect x="40"  y="38" width="120" height="24" rx="3" fill="#d4d4d8" />
        {/* Right collar */}
        <rect x="160" y="26" width="14" height="48" rx="2" fill="#71717a" />
        {/* Right plate */}
        <rect x="174" y="5"  width="26" height="90" rx="4" fill="#f97316" />
      </svg>
    </div>
  )
}

export default function Icon() {
  return new ImageResponse(<BarbellIcon />, { ...size })
}

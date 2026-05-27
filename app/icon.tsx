import { ImageResponse } from 'next/og'

export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

// Shared barbell JSX — same image used for favicon and apple-touch-icon
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
        borderRadius: 96,          // rounded corners (iOS clips anyway, but looks better in browser)
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>

        {/* ── Left plate ────────────────────────────────────── */}
        <div style={{
          width: 52, height: 190,
          background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '8px 4px 4px 8px',
          boxShadow: '2px 0 8px rgba(0,0,0,0.4)',
        }} />

        {/* Left sleeve (narrower section between plate and bar) */}
        <div style={{
          width: 20, height: 106,
          background: '#71717a',
          borderRadius: 0,
        }} />

        {/* ── Bar ───────────────────────────────────────────── */}
        <div style={{
          width: 208, height: 28,
          background: 'linear-gradient(180deg, #f4f4f5 0%, #a1a1aa 50%, #f4f4f5 100%)',
          borderRadius: 4,
        }} />

        {/* Right sleeve */}
        <div style={{
          width: 20, height: 106,
          background: '#71717a',
          borderRadius: 0,
        }} />

        {/* ── Right plate ───────────────────────────────────── */}
        <div style={{
          width: 52, height: 190,
          background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '4px 8px 8px 4px',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.4)',
        }} />

      </div>
    </div>
  )
}

export default function Icon() {
  return new ImageResponse(<BarbellIcon />, { ...size })
}

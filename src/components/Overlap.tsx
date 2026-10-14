import { type ReactNode } from 'react'

export function Overlap({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="overlap">
      <div className="overlap-disc overlap-a">{left}</div>
      <div className="overlap-disc overlap-b">{right}</div>
    </div>
  )
}

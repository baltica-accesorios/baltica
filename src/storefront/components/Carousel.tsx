'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BANNERS } from '@/data/categories'

export function Carousel() {
  const [slide, setSlide] = useState(0)
  useEffect(() => { const t = setInterval(() => setSlide(s => (s + 1) % BANNERS.length), 4000); return () => clearInterval(t) }, [])
  return (
    <section className="sf-carousel">
      <Link href="/grabados"><img src={BANNERS[slide]} alt="Báltica Accesorios" /></Link>
      <div className="sf-dots">{BANNERS.map((_, i) => <span key={i} role="button" aria-label={`Banner ${i + 1}`} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} />)}</div>
    </section>
  )
}

'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BANNERS } from '@/data/categories'

export function Carousel({ banners = BANNERS.map(image => ({ image, href: '/grabados', alt: 'Báltica Accesorios' })) }: { banners?: { image: string; href: string; alt: string }[] }) {
  const [slide, setSlide] = useState(0)
  useEffect(() => { const t = setInterval(() => setSlide(s => (s + 1) % Math.max(1, banners.length)), 4000); return () => clearInterval(t) }, [banners.length])
  if (!banners.length) return null
  const current = banners[slide % banners.length]
  return (
    <section className="sf-carousel">
      <Link href={current.href || "/productos"}><img src={current.image} alt={current.alt} /></Link>
      <div className="sf-dots">{banners.map((_, i) => <span key={i} role="button" aria-label={`Banner ${i + 1}`} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} />)}</div>
    </section>
  )
}

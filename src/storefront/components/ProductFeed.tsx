'use client'
import { useEffect, useRef, useState } from 'react'
import type { PublicProduct } from '@/lib/types'
import { ProductCard } from './ProductCard'
export function ProductFeed({ products, selectedVariants = {} }: { products: PublicProduct[]; selectedVariants?: Record<string, string> }) {
  const [count, setCount] = useState(24)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => setCount(24), [products])
  useEffect(() => {
    if (!end.current || count >= products.length) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setCount(n => Math.min(n + 24, products.length))
    }, { rootMargin: '500px' })
    observer.observe(end.current)
    return () => observer.disconnect()
  }, [count, products.length])
  return <><div className="sf-feed">{products.slice(0, count).map(p => <ProductCard key={p.id} p={p} variant={selectedVariants[p.id]} />)}</div><div ref={end} role="status" style={{ textAlign: 'center', padding: 24 }}>{count < products.length ? 'Cargando más productos…' : `${products.length} productos`}</div></>
}

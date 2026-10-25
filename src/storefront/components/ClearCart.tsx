'use client'
import { useEffect } from 'react'
import { useCart } from '../cart'

export function ClearCart() {
  const clear = useCart(s => s.clear)
  useEffect(() => { clear() }, [clear])
  return null
}

'use client'
// Datos que usan casi todas las pantallas del panel. Se cargan en el servidor (layout del panel)
// y se refrescan solos después de cada acción (las server actions revalidan la página).
import { createContext, useContext } from 'react'
import type { LabelTemplate, Product, Settings, User } from '@/lib/types'

export interface AdminData { products: Product[]; settings: Settings; labelTemplates: LabelTemplate[]; user: User; badges: { low: number; pending: number }; hasAnthropicKey: boolean }

const Ctx = createContext<AdminData | null>(null)

export function AdminProvider({ value, children }: { value: AdminData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAdmin() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAdmin fuera del panel')
  return v
}

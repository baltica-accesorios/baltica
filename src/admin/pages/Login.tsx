'use client'
import { useActionState } from 'react'
import { LOGO } from '@/data/categories'
import { login, setupOwner } from '../login-actions'
import { btnPrimary, input } from '../components/AdminLayout'

export function LoginForm({ setup }: { setup: boolean }) {
  const [error, action, pending] = useActionState(setup ? setupOwner : login, null)
  return (
    <div className="adm min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <form action={action} className="bg-white rounded-2xl border border-stone-200 shadow-sm w-full max-w-sm p-8 space-y-4">
        <img src={LOGO} alt="Báltica" className="h-14 mx-auto" />
        <div className="text-center">
          <h1 className="text-xl font-bold">{setup ? 'Crear la cuenta de la dueña' : 'Panel de gestión'}</h1>
          {setup && <p className="text-sm text-stone-500 mt-1">Es el primer ingreso. Esta cuenta puede ver todo y crear usuarios para las vendedoras.</p>}
        </div>
        {setup && <label className="block text-sm">Tu nombre<input name="name" required className={input + ' mt-1'} autoComplete="name" /></label>}
        <label className="block text-sm">Email<input name="email" type="email" required className={input + ' mt-1'} autoComplete="email" inputMode="email" /></label>
        <label className="block text-sm">Contraseña<input name="password" type="password" required minLength={setup ? 8 : undefined} className={input + ' mt-1'} autoComplete={setup ? 'new-password' : 'current-password'} /></label>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button className={btnPrimary + ' w-full justify-center py-3'} disabled={pending}>{pending ? 'Un momento…' : setup ? 'Crear cuenta y entrar' : 'Ingresar'}</button>
      </form>
    </div>
  )
}

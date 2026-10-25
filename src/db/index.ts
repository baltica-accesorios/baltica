import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Una sola conexión por proceso (en desarrollo Next recarga módulos, por eso se guarda en globalThis).
// prepare: false porque en producción se usa el pooler de Neon (pgbouncer).
const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> }
const client = g.pg ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 })
if (process.env.NODE_ENV !== 'production') g.pg = client

export const db = drizzle(client, { schema })
export type DB = typeof db
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
export { schema }

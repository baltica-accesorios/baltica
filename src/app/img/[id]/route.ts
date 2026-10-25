import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

// Las fotos nunca cambian (una foto nueva tiene otro id), así que el CDN las guarda para siempre.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [img] = await db.select().from(schema.images).where(eq(schema.images.id, id))
  if (!img) return new Response('No encontrada', { status: 404 })
  return new Response(new Uint8Array(img.data), { headers: { 'Content-Type': img.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } })
}

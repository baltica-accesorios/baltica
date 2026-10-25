import type { NextConfig } from 'next'

const config: NextConfig = {
  // Las fotos de productos y facturas se suben por server actions
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
}

export default config

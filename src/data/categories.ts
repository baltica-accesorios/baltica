// Imágenes descargadas a public/media para no depender del CDN de Empretienda cuando se dé de baja.
export interface Category {
  slug: string
  name: string
  image?: string
  href?: string
  tileTitle?: string
  children?: { slug: string; name: string }[]
}

// Árbol de categorías tal cual está hoy en balticaaccesorios.com.ar (menú PRODUCTOS)
export const CATEGORIES: Category[] = [
  { slug: 'grabados', name: 'GRABADOS', image: '/media/ead21de5a870062b0be9356b72d5bc35528f1e575db73f10926457fe1600733f225104.jpg' },
  { slug: 'abridores', name: 'ABRIDORES', image: '/media/0b7d2e2694eb1a9608cc0e6d6fd77d7460a265d4f4499f9927c32ba1e124d6f9225104.jpg', children: [
    { slug: 'abridores-plata', name: 'Abridores plata' }, { slug: 'abridores-acero-quirurgico', name: 'Abridores acero quirúrgico' } ] },
  { slug: 'argollas', name: 'ARGOLLAS', image: '/media/38ac3f2f6ea979eab37b9fe9aa84f1a64bbf6e7ae8239fe499878b3c7f3f6f80225104.jpg', children: [
    { slug: 'argollas-plata', name: 'Argollas plata' }, { slug: 'argollas-acero-blanco', name: 'Argollas acero blanco' }, { slug: 'argollas-acero-quirurgico', name: 'Argollas acero quirúrgico' }, { slug: 'argollas-acero-dorado', name: 'Argollas acero dorado' } ] },
  { slug: 'anillos', name: 'ANILLOS', image: '/media/7013375f06eb500dfd469647e06d9f66612aecf5b31c08ad33428d89de6c3f2c225104.jpg', children: [
    { slug: 'anillos-plata', name: 'Anillos plata' }, { slug: 'anillos-acero-blanco', name: 'Anillos acero blanco' }, { slug: 'anillos-acero-quirurgico', name: 'Anillos acero quirúrgico' }, { slug: 'anillos-acero-dorado', name: 'Anillos acero dorado' } ] },
  { slug: 'aritos', name: 'ARITOS', image: '/media/426f9e6ff08362687f32b16bd599b4eb54e9ffd85702191976d3c6891d442ed9225104.jpg', children: [
    { slug: 'aritos-plata', name: 'Aritos plata' }, { slug: 'aritos-acero-blanco', name: 'Aritos acero blanco' }, { slug: 'aritos-acero-quirurgico', name: 'Aritos acero quirúrgico' }, { slug: 'aritos-acero-dorado', name: 'Aritos acero dorado' } ] },
  { slug: 'piercings', name: 'PIERCINGS', image: '/media/df76dc5cd844e1f941c61f8e04a6b770584ad74be68c1003cee4442733564145225104.jpg', children: [
    { slug: 'piercings-plata', name: 'Piercings plata' }, { slug: 'piercings-acero-quirurgico', name: 'Piercings acero quirúrgico' } ] },
  { slug: 'cadenitas', name: 'CADENITAS', image: '/media/bac35ea1500c42ee42d5ff054b7e6f1571dd9c3112fb5e21af3507551a5036e4225104.jpg', children: [
    { slug: 'cadenitas-plata', name: 'Cadenitas plata' }, { slug: 'cadenitas-acero-blanco', name: 'Cadenitas acero blanco' }, { slug: 'cadenitas-acero-quirurgico', name: 'Cadenitas acero quirúrgico' }, { slug: 'cadenitas-acero-dorado', name: 'Cadenitas acero dorado' } ] },
  { slug: 'collarcitos', name: 'COLLARCITOS' },
  { slug: 'pulseras', name: 'PULSERAS', image: '/media/c93e1433a243718543b5a7d93f198174fe995a20f1b63230598d2751750284ca225104.jpg', children: [
    { slug: 'pulseras-plata', name: 'Pulseras plata' }, { slug: 'pulseras-acero-blanco', name: 'Pulseras acero blanco' }, { slug: 'pulseras-acero-quirurgico', name: 'Pulseras acero quirúrgico' }, { slug: 'pulseras-acero-dorado', name: 'Pulseras acero dorado' }, { slug: 'pulseras-protectoras', name: 'Pulseras protectoras' } ] },
  { slug: 'dijes', name: 'DIJES', image: '/media/c3a7ab659220bfcb85063e3032410000ed0df4274819d439caf0f13c1fbea5b7225104.jpg', children: [ { slug: 'dijes-plata', name: 'Dijes plata' } ] },
  { slug: 'trepadores', name: 'TREPADORES', image: '/media/ceed44b375713f85813bb444eb0be12d2740fd3ed63269dd61d8fcb0ad569274225104.jpg', children: [ { slug: 'trepadores-plata', name: 'Trepadores plata' } ] },
  { slug: 'apretadores', name: 'APRETADORES', image: '/media/fdeea62c26ab89cee356d692b72de3fa519f146962d792b4e50c4a18ac77c013225104.jpg', children: [ { slug: 'apretadores-plata', name: 'Apretadores plata' } ] },
  { slug: 'fantasia', name: 'FANTASIA', image: '/media/21820caf57093f32bc2d1027c7fcbbf74028eb8330f2f81f450631c5ece03430225104.jpg', children: [ { slug: 'brazaletes', name: 'BRAZALETES' }, { slug: 'aros', name: 'AROS' } ] },
  { slug: 'perforadoras', name: 'PERFORADORAS', image: '/media/d995d76915272b0479ddcee92b282203c41ee4bd65d960850cab0763ef735e3b225104.jpg' },
  { slug: 'alhajeros', name: 'ALHAJEROS', image: '/media/35e454459ec5bb8a18f891e3ea88a9aefbebf0272df0c6f0a2b191226bfd23dc225104.jpg' },
  { slug: 'perfumeros', name: 'PERFUMEROS', image: '/media/2df4edef1b7da5bd866ac90170a8a4552b7895050412c44923dc61b73db30d40225104.jpg' },
  { slug: 'gift-cards', name: 'GIFT CARDS', image: '/media/e74d858d432c2ca19fe4f388ad84c93d846aa8eda53049b08e951f87576d496e225104.jpg' },
  { slug: 'promos', name: 'PROMOS' },
  { slug: 'escarapelas', name: 'ESCARAPELAS' },
]

// Grilla de "imágenes compuestas" del inicio, en el orden real del sitio
export const HOME_GRID: { slug: string; title: string }[] = [
  { slug: 'argollas', title: 'Argollas' }, { slug: 'cadenitas', title: 'Cadenitas' }, { slug: 'abridores', title: 'Abridores' },
  { slug: 'pulseras', title: 'Pulseras' }, { slug: 'aritos', title: 'Aritos' }, { slug: 'trepadores', title: 'Trepadores' },
  { slug: 'anillos', title: 'Anillos' }, { slug: 'piercings', title: 'Piercings' }, { slug: 'alhajeros', title: 'Alhajeros' },
  { slug: 'dijes', title: 'Dijes' }, { slug: 'perfumeros', title: 'Perfumeros' }, { slug: 'perforadoras', title: 'Perforadoras' },
  { slug: 'apretadores', title: 'Apretadores' }, { slug: 'fantasia', title: 'Fantasía' }, { slug: 'gift-cards', title: 'Gift Cards' },
  { slug: 'grabados', title: 'Grabados' },
]

export const BANNERS = [
  '/media/e57b3c4356059e809d45ed6e6e560e270a172afd1536b075b0fe8944988e83a3225104.jpg',
  '/media/44ed7650267d8d2c8767099a932353e66ec99f08914d209550107456fb5ab335225104.jpg',
]

export const LOGO = '/media/dd851e10e4ffb8dd57223bbac021f09e733a4d989436b9b0d04824204cf30a19225104.png'

export const INFO_PAGES = [
  { slug: 'talles-anillos', name: 'Talles anillos' }, { slug: 'cambios', name: 'Cambios' }, { slug: 'cuidados-y-limpieza', name: 'Cuidados y limpieza' }, { slug: 'mayoristas', name: 'MAYORISTAS' },
]

export function categoryName(slug: string) { return CATEGORIES.find(c => c.slug === slug)?.name ?? slug }
export function subcategoryName(slug?: string | null) {
  if (!slug) return undefined
  for (const c of CATEGORIES) { const s = c.children?.find(x => x.slug === slug); if (s) return s.name }
  return slug
}

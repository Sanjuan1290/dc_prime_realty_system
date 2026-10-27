import luntiangLocationMap from '../assets/luntiang-location-map.png'

export const projects = [
  {
    slug: 'luntiang-aguinaldo-bailen',
    name: 'Luntiang Aguinaldo',
    shortName: 'Bailen',
    location: 'Bailen, Cavite',
    type: 'Residential and investment lots',
    status: 'available',
    statusLabel: 'Available',
    bookingEnabled: true,
    logo: '/website/images/project-logos/luntiang-aguinaldo.svg',
    coverImage: '/website/images/bailen/luntiang-aguinaldo-cover.jpg',
    locationMap: luntiangLocationMap,
    locationMapAlt: 'Luntiang Aguinaldo location map with estimated distances to nearby landmarks',
    lastUpdated: 'July 2026',
    visitNote: 'Wear comfortable footwear and confirm the meeting point before travelling.',
    overview: 'A land project in Bailen, Cavite with open surroundings, natural scenery and lot options for buyers planning a future home or long-term property investment.',
    features: ['Lot-only options', 'Natural surroundings', 'Scheduled site visits'],
    highlights: [
      'Located in Bailen, Cavite',
      'Lot-only property options',
      'Open land and natural surroundings',
      'Property tripping available by schedule',
    ],
    progress: [
      { date: '2026', title: 'Project presentation available', description: 'Project photos and initial property information are available for buyer review.' },
      { date: 'Current', title: 'Scheduled site visits', description: 'Property tripping requests are accepted on available days.' },
    ],
    gallery: [
      { src: '/website/images/bailen/luntiang-aguinaldo-cover.jpg', alt: 'Aerial view of Luntiang Aguinaldo in Bailen, Cavite' },
      { src: '/website/images/bailen/aerial-greenery.jpg', alt: 'Aerial view of green land and roads near the Bailen project' },
      { src: '/website/images/bailen/site-road.jpg', alt: 'Cleared project road and open land in Bailen' },
      { src: '/website/images/bailen/river-pool.jpg', alt: 'Natural river pool near Bailen, Cavite' },
      { src: '/website/images/bailen/rock-river.jpg', alt: 'Rocky river scenery near Bailen' },
      { src: '/website/images/bailen/waterfall.jpg', alt: 'Waterfall and natural scenery near Bailen, Cavite' },
    ],
    seoTitle: 'Luntiang Aguinaldo Lots in Bailen, Cavite | D&C Prime Realty',
    seoDescription: 'View Luntiang Aguinaldo property information, project photos and tripping details for available lots in Bailen, Cavite.',
  },
  {
    slug: 'prime-enclave-maragondon',
    name: 'Prime Enclave',
    shortName: 'Maragondon',
    location: 'Pantihan 4, Maragondon, Cavite',
    type: 'Residential and investment lots',
    status: 'available',
    statusLabel: 'Available',
    bookingEnabled: true,
    logo: '/website/images/project-logos/prime-enclave.svg',
    coverImage: '/website/images/maragondon/prime-enclave-cover.jpg',
    video: '/website/videos/maragondon-hero.mp4',
    lastUpdated: 'July 2026',
    visitNote: 'Confirm the access-road meeting point before travelling to the project.',
    overview: 'A lot project in Pantihan 4, Maragondon, Cavite with road-access information and site views shown through aerial footage and guided property visits.',
    features: ['Lot-only options', 'Aerial video', 'Scheduled site visits'],
    highlights: [
      'Located in Pantihan 4, Maragondon',
      'Lot-only property options',
      'Aerial project and access-road footage',
      'Guided property visits by appointment',
    ],
    progress: [
      { date: '2026', title: 'Aerial project documentation', description: 'Aerial footage was prepared to help visitors review the location and access route.' },
      { date: 'Current', title: 'Guided site visits', description: 'Property tripping requests are accepted on available days.' },
    ],
    gallery: [
      { src: '/website/images/maragondon/prime-enclave-cover.jpg', alt: 'Aerial view of Prime Enclave in Maragondon, Cavite' },
      { src: '/website/images/maragondon/site-visit.jpg', alt: 'D&C Prime Realty team conducting a site visit in Maragondon' },
      { src: '/website/images/maragondon/site-visit-collage.jpg', alt: 'Team property inspection and site visit collage in Maragondon' },
      { src: '/website/images/maragondon/access-road-visit.jpg', alt: 'Property guides walking along the access road in Maragondon' },
    ],
    seoTitle: 'Prime Enclave Lots in Maragondon, Cavite | D&C Prime Realty',
    seoDescription: 'View Prime Enclave project information, aerial footage and tripping details for available lots in Maragondon, Cavite.',
  },
]

export const getProjectBySlug = (slug) => projects.find((project) => project.slug === slug)




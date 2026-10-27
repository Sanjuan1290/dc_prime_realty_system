// Public site content is deliberately static. Real images and current terms can be substituted here.
export const brand = {
  name: 'D&C Prime Realty',
  email: 'dcprimegold@gmail.com',
  address: "Unit D, Mia's Commercial Building, Indang, Cavite 4122",
  facebook: 'https://www.facebook.com/dcprimerealtyOfficial',
  logo: '/website/images/redesign/dc-prime-logo-gold.png',
  hero: '/website/images/drive/maragondon/prime-enclave-aerial.webp', // Still-image poster and fallback
  heroVideo: '/website/images/drive/maragondon/prime-enclave-hero-loop.mp4', // Short, silent clip from the approved Maragondon tour
}

export const companyMedia = {
  team: '/website/images/drive/company/team-collage.webp',
  event: '/website/images/drive/company/team-event.webp',
}

export const navigation = [
  { title: 'Home', to: '/' },
  { title: 'About', to: '/about-us' },
  { title: 'Projects', to: '/properties' },
  { title: 'Blogs', to: '/blog' },
  { title: 'Sellers', to: '/sellers' },
  { title: 'Opportunities', to: '/opportunities' },
  { title: 'Contact', to: '/contact-us' },
]

export const staticProjects = [
  {
    slug: 'prime-enclave-maragondon',
    name: 'Prime Enclave',
    city: 'Maragondon, Cavite',
    address: 'Pantihan IV, Maragondon, Cavite',
    status: 'Featured lot project',
    eyebrow: 'PRIME ENCLAVE · MARAGONDON',
    subtitle: 'A quieter place for your next chapter.',
    intro: 'Countryside lots with open views and space for long-term plans. Explore the surroundings, ask about available lots and schedule a guided site visit.',
    image: '/website/images/drive/maragondon/prime-enclave-aerial.webp',
    gallery: [
      { src: '/website/images/drive/maragondon/prime-enclave-aerial.webp', alt: 'Aerial greenery and access road in the Maragondon project media', caption: 'Maragondon · Aerial surroundings' },
      { src: '/website/images/drive/maragondon/prime-enclave-lot-view.webp', alt: 'Overhead view of terrain in the Maragondon project media', caption: 'Maragondon · Land and terrain' },
      { src: '/website/images/drive/maragondon/prime-enclave-sunset.webp', alt: 'Sunset above farmland in the Maragondon project media', caption: 'Maragondon · Sunset view' },
    ],
    video: {src:'/website/images/drive/maragondon/prime-enclave-tour.mp4', label:'Maragondon project video', note:'Project video supplied by D&C Prime Realty. Locations and any on-screen diagrams are informational; confirm lot boundaries and access during a site visit.'},
    fallback: '/website/images/redesign/scenic-maragondon-placeholder.webp',
    features: ['Countryside setting', 'Mountain views', 'Site visits by appointment', 'Lot-only property options'],
    points: [
      { number: '01', title: 'A natural setting', detail: 'Experience the open countryside and views around Pantihan IV.' },
      { number: '02', title: 'Room for your plans', detail: 'Ask about the current lot sizes, payment terms and project documents.' },
      { number: '03', title: 'See it in person', detail: 'A guided visit helps you review access, terrain and available units.' },
    ],
  },
  {
    slug: 'luntiang-aguinaldo-bailen',
    name: 'Luntiang Aguinaldo',
    city: 'Bailen, Cavite',
    address: 'Bailen, Cavite',
    status: 'Lot project',
    eyebrow: 'LUNTIANG AGUINALDO · BAILEN',
    subtitle: 'Open spaces. A fresh perspective.',
    intro: 'Explore lot-only property options in Bailen, Cavite, with natural surroundings and guided visits by arrangement.',
    image: '/website/images/drive/bailen/luntiang-site-road.webp',
    gallery: [
      { src: '/website/images/drive/bailen/luntiang-site-road.webp', alt: 'Earth access road in Bailen project media', caption: 'Bailen · Access road' },
      { src: '/website/images/drive/bailen/luntiang-hillside.webp', alt: 'Green hills and countryside in Bailen project media', caption: 'Bailen · Hillside terrain' },
      { src: '/website/images/drive/bailen/luntiang-aerial.webp', alt: 'Aerial view of a hillside track and greenery in Bailen project media', caption: 'Bailen · Aerial view' },
      { src: '/website/images/drive/bailen/luntiang-trail.webp', alt: 'Steep green hillside and track from Bailen media', caption: 'Bailen · Land view' },
      { src: '/website/images/drive/bailen/bailen-waterfall.webp', alt: 'Waterfall in the Bailen area media collection', caption: 'Bailen area · Waterfall surroundings' },
      { src: '/website/images/drive/bailen/bailen-rock-river.webp', alt: 'Rocky river in the Bailen area media collection', caption: 'Bailen area · River scenery' },
      { src: '/website/images/drive/bailen/bailen-river-pool.webp', alt: 'Natural pool in the Bailen area media collection', caption: 'Bailen area · River pool' },
    ],
    video: {src:'/website/images/drive/bailen/luntiang-aerial-tour.mp4', label:'Bailen aerial property video', note:'Footage from the Bailen project media folder. Nearby scenery is not presented as a project amenity.'},
    fallback: '/website/images/redesign/scenic-bailen-placeholder.webp',
    features: ['Lot-only options', 'Natural surroundings', 'Project information on request', 'Scheduled site visits'],
    points: [
      { number: '01', title: 'Land to consider', detail: 'Review the current property options and intended lot uses.' },
      { number: '02', title: 'Local surroundings', detail: 'Visit the area and check the roads and community yourself.' },
      { number: '03', title: 'Clear next steps', detail: 'Request an updated quotation and full payment information.' },
    ],
  },
]

export const benefits = [
  ['01','Real locations', 'Explore projects based in Cavite.'],
  ['02','Property guidance','Ask about lots, access and documents.'],
  ['03','Personal site visits','Arrange a viewing with the team.'],
  ['04','Clear information','Review written terms before reserving.'],
]

export const emailRequest = (subject, lines) => {
  const body = lines.map(([label,value]) => `${label}: ${String(value || 'Not provided').trim()}`).join('\n')
  return `mailto:${brand.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body+'\n\nPlease contact me to confirm the next steps.')}`
}

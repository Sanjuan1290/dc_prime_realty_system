// Public site content is deliberately static. Real images and current terms can be substituted here.
export const brand = {
  name: 'D&C Prime Realty',
  email: 'dcprimegold@gmail.com',
  address: "Unit D, Mia's Commercial Building, Indang, Cavite 4122",
  facebook: 'https://www.facebook.com/dcprimerealtyOfficial',
  logo: '/website/images/redesign/dc-prime-logo-gold.png',
  hero: '/website/images/redesign/scenic-hero-placeholder.jpg',
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
    image: '/website/images/maragondon/prime-enclave-cover.jpg',
    fallback: '/website/images/redesign/scenic-maragondon-placeholder.jpg',
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
    image: '/website/images/bailen/luntiang-aguinaldo-cover.jpg',
    fallback: '/website/images/redesign/scenic-bailen-placeholder.jpg',
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

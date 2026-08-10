export const company = {
  name: 'D&C Prime Realty',
  tagline: 'Your trusted real estate solutions',
  address: "Unit D, Mia's Commercial Building, Indang, Cavite 4122",
  serviceArea: 'Cavite, Philippines',
  email: 'dcprimegold@gmail.com',
  facebookUrl: 'https://www.facebook.com/dcprimerealtyOfficial',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d872.5276795418114!2d120.88587640192104!3d14.220962850547908!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33bd81ca9dab0243%3A0x9b496d451e0bef9f!2sD%26C%20PRIME%20REALTY!5e0!3m2!1sen!2sph!4v1785310472343!5m2!1sen!2sph',
  values: [
    { title: 'Trust', description: 'Clear property information and guided client assistance.' },
    { title: 'Commitment', description: 'Support from your first inquiry through the property visit.' },
    { title: 'Integrity', description: 'Straightforward communication about projects and payment options.' },
    { title: 'Excellence', description: 'A service-focused team that helps you make informed decisions.' },
  ],
}

export const siteNavigation = [
  { label: 'Home', to: '/' },
  {
    label: 'Properties',
    children: [
      { label: 'All Properties', to: '/properties', description: 'View all current and upcoming projects.' },
      { label: 'Luntiang Aguinaldo', to: '/properties/luntiang-aguinaldo-bailen', description: 'Available lots in Bailen, Cavite.', logo: '/website/images/project-logos/luntiang-aguinaldo.svg' },
      { label: 'Prime Enclave', to: '/properties/prime-enclave-maragondon', description: 'Available lots in Maragondon, Cavite.', logo: '/website/images/project-logos/prime-enclave.svg' },
      { label: 'General Trias', to: '/properties/general-trias-coming-soon', description: 'New project information coming soon.', logo: '/website/images/project-logos/general-trias.svg' },
    ],
  },
  {
    label: 'Company',
    children: [
      { label: 'About Us', to: '/about-us', description: 'Our company, values and activities.' },
      { label: 'Site Coordinator', to: '/site-coordinator', description: 'Project-visit coordination and professional guidance.' },
      { label: 'Property Guidance Team', to: '/sellers', description: 'How the team assists property buyers and visitors.' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Blog', to: '/blog', description: 'Buyer guides, project information and site-visit tips.' },
      { label: 'FAQs', to: '/faqs', description: 'Answers about projects, pricing and tripping schedules.' },
      { label: 'Visit Checklist', to: '/visit-checklist', description: 'Prepare for a scheduled property visit.' },
      { label: 'Payment Estimator', to: '/payment-estimator', description: 'Create a sample payment breakdown.' },
      { label: 'Saved Projects', to: '/saved-projects', description: 'Review projects saved in this browser.' },
    ],
  },
  { label: 'Contact Us', to: '/contact-us' },
]

export const flattenNavigation = siteNavigation.flatMap((item) => item.children || [item])



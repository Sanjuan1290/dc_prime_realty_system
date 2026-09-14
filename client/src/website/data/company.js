export const company = {
  name: 'D&C Prime Realty',
  tagline: 'Your trusted real estate solutions',
  address: "Unit D, Mia's Commercial Building, Indang, Cavite 4122",
  serviceArea: 'Cavite, Philippines',
  email: 'dcprimegold@gmail.com',
  facebookUrl: 'https://www.facebook.com/dcprimerealtyOfficial',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d872.5276795418114!2d120.88587640192104!3d14.220962850547908!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33bd81ca9dab0243%3A0x9b496d451e0bef9f!2sD%26C%20PRIME%20REALTY!5e0!3m2!1sen!2sph!4v1785310472343!5m2!1sen!2sph',
  officeHours: {
    openDays: 'Monday, Tuesday, Friday–Sunday',
    closedDays: 'Wednesday and Thursday',
    hours: '9:00 AM – 8:00 PM',
  },
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
      { label: 'All Properties', to: '/properties', description: 'View current and upcoming D&C Prime Realty projects.' },
      { label: 'Luntiang Aguinaldo', to: '/properties/luntiang-aguinaldo-bailen', description: 'Available lots in Bailen, Cavite.', logo: '/website/images/project-logos/luntiang-aguinaldo.svg' },
      { label: 'Prime Enclave', to: '/properties/prime-enclave-maragondon', description: 'Available lots in Maragondon, Cavite.', logo: '/website/images/project-logos/prime-enclave.svg' },
      { label: 'General Trias', to: '/properties/general-trias-coming-soon', description: 'New project information coming soon.', logo: '/website/images/project-logos/general-trias.svg' },
    ],
  },
  { label: 'Tripping', to: '/properties#book-tripping' },
  {
    label: 'Company',
    children: [
      { label: 'About D&C Prime Realty', to: '/about-us', description: 'Our company, office, values and activities.' },
      { label: 'Our Team', to: '/sellers', description: 'Leadership, departments and property guidance.' },
      { label: 'Our Projects', to: '/properties', description: 'Ongoing and upcoming property developments.' },
      { label: 'Careers', to: '/about-us#careers', description: 'Employee opportunities and seller accreditation.' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Blog', to: '/blog', description: 'Buyer guides, project information and site-visit tips.' },
      { label: 'FAQs', to: '/faqs', description: 'Answers about projects, pricing and tripping schedules.' },
      { label: 'Visit Checklist', to: '/visit-checklist', description: 'Prepare for a scheduled property visit.' },
      { label: 'Saved Projects', to: '/saved-projects', description: 'Review projects saved in this browser.' },
    ],
  },
  { label: 'Contact Us', to: '/contact-us' },
]

export const flattenNavigation = siteNavigation.flatMap((item) => item.children || [item])

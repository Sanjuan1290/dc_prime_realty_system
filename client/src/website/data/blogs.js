export const blogs = [
  {
    slug: 'what-to-check-before-buying-a-lot-in-cavite',
    category: 'Buyer Guide',
    title: 'What to Check Before Buying a Lot in Cavite',
    excerpt: 'Review the location, property documents, site conditions and complete payment breakdown before you reserve a lot.',
    image: '/website/images/bailen/site-road.jpg',
    imageAlt: 'Cleared project road and open property area in Bailen, Cavite',
    date: 'July 29, 2026',
    publishedAt: '2026-07-29',
    updatedAt: '2026-07-29',
    readingTime: '5 min read',
    relatedProject: 'Luntiang Aguinaldo',
    metaDescription: 'Review the property location, documents, payment terms and site conditions before buying a lot in Cavite.',
    sections: [
      {
        heading: 'Visit the property before making a decision',
        paragraphs: [
          'Buying a lot in Cavite requires more than checking the size and advertised price. A property visit helps you review the access road, terrain, surrounding area and the actual position of the available unit.',
          'Ask your property guide to explain the project boundaries, available unit markers and nearby roads. Take your own photos and notes so you can compare the site with the written project information after the visit.',
        ],
      },
      {
        heading: 'Review the project and property documents',
        paragraphs: [
          'Ask which title, tax declaration and project documents are available for inspection. Confirm that the unit information shown to you matches the quotation, reservation form and other written records.',
          'Do not rely only on verbal statements. Request copies or official references for the documents that form part of your purchase decision.',
        ],
      },
      {
        heading: 'Request the complete payment breakdown',
        paragraphs: [
          'Review the reservation fee, downpayment, monthly payment, legal and miscellaneous fees, discounts and total contract price. A low monthly amount may not show the full cost of the property.',
          'Ask what happens when a payment is late, when the first due date starts and which charges may apply during the contract period.',
        ],
      },
      {
        heading: 'Confirm the unit status before paying',
        paragraphs: [
          'Confirm that the selected unit remains available before transferring money. Check the official payment instructions and request a receipt for every verified payment.',
          'D&C Prime Realty currently presents property options in Bailen and Maragondon, Cavite. A scheduled property tripping can help you compare the locations before you reserve.',
        ],
      },
    ],
  },
  {
    slug: 'bailen-or-maragondon-property-guide',
    category: 'Location Guide',
    title: 'Bailen or Maragondon: Which Property Location Fits Your Plans?',
    excerpt: 'Compare the two current project locations based on your intended use, preferred surroundings and property goals.',
    image: '/website/images/bailen/aerial-greenery.jpg',
    imageAlt: 'Aerial greenery and road network near the Bailen property project',
    date: 'July 29, 2026',
    publishedAt: '2026-07-29',
    updatedAt: '2026-07-29',
    readingTime: '4 min read',
    relatedProject: 'Bailen and Maragondon',
    metaDescription: 'Compare property options in Bailen and Maragondon based on your goals, preferred environment and intended use.',
    sections: [
      {
        heading: 'Consider the environment you prefer',
        paragraphs: [
          'Luntiang Aguinaldo in Bailen features open land and natural surroundings. It may suit buyers considering a future home, agricultural use or a long-term property purchase.',
          'Prime Enclave is in Pantihan 4, Maragondon. Its project materials show aerial views, surrounding roads and the route toward the site. A visit will give you a clearer view of the current access and terrain.',
        ],
      },
      {
        heading: 'Match the location with your intended use',
        paragraphs: [
          'Write down how you plan to use the lot. A future residence, agricultural activity and long-term investment can require different lot sizes, road conditions and surrounding services.',
          'Ask the property team which available units fit your budget and intended use. Compare written payment samples rather than choosing only from photos.',
        ],
      },
      {
        heading: 'Compare access during an actual visit',
        paragraphs: [
          'Road access can change how often you can visit or use the property. Check the route during the same type of weather and travel time you expect after purchase.',
          'Regular property tripping is available on selected days, excluding Tuesday and Thursday. Contact the office if you need help arranging another schedule.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-prepare-for-a-property-tripping-in-cavite',
    category: 'Property Tripping',
    title: 'How to Prepare for a Property Tripping in Cavite',
    excerpt: 'Bring the right questions and review the road, unit location, property information and payment terms during your visit.',
    image: '/website/images/maragondon/access-road-visit.jpg',
    imageAlt: 'Property visitors walking along a project access road in Maragondon',
    date: 'July 29, 2026',
    publishedAt: '2026-07-29',
    updatedAt: '2026-07-29',
    readingTime: '4 min read',
    relatedProject: 'Prime Enclave',
    metaDescription: 'Prepare for a property tripping in Cavite with a list of questions, documents and site details to review.',
    sections: [
      {
        heading: 'Confirm the meeting details',
        paragraphs: [
          'Confirm the meeting point, date, time and assigned property guide before you travel. Ask about the expected road condition and the type of vehicle or footwear that may be suitable for the site.',
          'Tuesday and Thursday are unavailable for regular tripping. Choose another date or contact the office directly for assistance.',
        ],
      },
      {
        heading: 'Bring a practical checklist',
        paragraphs: [
          'Bring a valid ID, your phone, water, comfortable footwear and a written list of questions. Record the unit reference, lot area, road access and nearby landmarks when your guide explains them.',
          'Ask about available units, price per square metre, reservation fee, payment terms, required buyer documents and the next step after reservation.',
        ],
      },
      {
        heading: 'Compare the visit with the written quotation',
        paragraphs: [
          'After the visit, compare the information you received with the written quotation or payment sample. Check that the project, unit and price details remain consistent.',
          'A property tripping should help you make a clearer decision. Take time to review the information before paying a reservation fee.',
        ],
      },
    ],
  },
]

export const getBlogBySlug = (slug) => blogs.find((blog) => blog.slug === slug)

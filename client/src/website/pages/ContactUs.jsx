import { useMemo, useState } from 'react'
import { FiFacebook, FiMail, FiMapPin, FiMessageSquare } from 'react-icons/fi'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'
import { Link, useSearchParams } from 'react-router-dom'
import { company } from '../data/company'

const intentToSubject = {
  tripping: 'Book a Tripping',
  seller: 'Become an Accredited Seller',
  career: 'Career Opportunity',
  property: 'Property Information',
}

const ContactUs = () => {
  const [searchParams] = useSearchParams()
  const initialSubject = intentToSubject[searchParams.get('intent')] || 'Property Information'
  const [form, setForm] = useState({ name: '', mobile: '', email: '', subject: initialSubject, message: '' })
  const [reviewed, setReviewed] = useState(false)

  usePageMeta({ title: 'Contact D&C Prime Realty', description: 'Contact D&C Prime Realty for property information, tripping, seller accreditation and general inquiries.' })

  const update = (field) => (event) => {
    setReviewed(false)
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(`${form.subject} — ${form.name || 'Website inquiry'}`)
    const body = encodeURIComponent([
      'Hello D&C Prime Realty,',
      '',
      `Name: ${form.name}`,
      `Mobile: ${form.mobile}`,
      `Email: ${form.email}`,
      `Inquiry: ${form.subject}`,
      '',
      form.message,
    ].join('\n'))
    return `mailto:${company.email}?subject=${subject}&body=${body}`
  }, [form])

  return (
    <>
      <PageHero eyebrow="Contact Us" title="How can D&C Prime Realty help?" description="Choose the type of inquiry so your message is easier for the team to review." image="/website/images/company/office-team-collage.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1180px] gap-9 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <SectionHeading eyebrow="Contact details" title="Speak with the D&C Prime Realty team" description={`Office hours: ${company.officeHours.hours}, ${company.officeHours.openDays}. Closed ${company.officeHours.closedDays}.`} />
            <div className="mt-6 space-y-3">
              <div className="flex gap-3 rounded-[14px] border border-[#ded9ce] bg-white p-4"><FiMapPin className="mt-1 h-5 w-5 shrink-0 text-[#806014]" /><div><p className="text-[12px] font-bold">Office address</p><p className="mt-1 text-[12px] leading-5 text-[#6d6960]">{company.address}</p></div></div>
              <a href={`mailto:${company.email}`} className="flex gap-3 rounded-[14px] border border-[#ded9ce] bg-white p-4 transition hover:border-[#b68a1f]"><FiMail className="mt-1 h-5 w-5 shrink-0 text-[#806014]" /><div><p className="text-[12px] font-bold text-[#302e29]">Email</p><p className="mt-1 text-[12px] text-[#6d6960]">{company.email}</p></div></a>
              <a href={company.facebookUrl} target="_blank" rel="noreferrer" className="flex gap-3 rounded-[14px] border border-[#ded9ce] bg-white p-4 transition hover:border-[#b68a1f]"><FiFacebook className="mt-1 h-5 w-5 shrink-0 text-[#806014]" /><div><p className="text-[12px] font-bold text-[#302e29]">Facebook</p><p className="mt-1 text-[12px] text-[#6d6960]">D&C Prime Realty Official</p></div></a>
            </div>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); setReviewed(true) }} className="rounded-[20px] border border-[#ded9ce] bg-white p-5 shadow-[0_12px_38px_rgba(44,36,20,0.07)] sm:p-6">
            <div className="flex items-center gap-3"><FiMessageSquare className="h-5 w-5 text-[#806014]" /><h2 className="text-[21px]">Prepare an inquiry</h2></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="website-label">How can we help?</span><select value={form.subject} onChange={update('subject')} className="website-input"><option>Property Information</option><option>Book a Tripping</option><option>Become an Accredited Seller</option><option>Career Opportunity</option><option>Project Update</option><option>General Inquiry</option></select></label>
              <label className="block"><span className="website-label">Full name</span><input required value={form.name} onChange={update('name')} className="website-input" placeholder="Your full name" /></label>
              <label className="block"><span className="website-label">Mobile number</span><input required value={form.mobile} onChange={update('mobile')} className="website-input" placeholder="09XX XXX XXXX" /></label>
              <label className="block sm:col-span-2"><span className="website-label">Email address</span><input type="email" required value={form.email} onChange={update('email')} className="website-input" placeholder="name@example.com" /></label>
              <label className="block sm:col-span-2"><span className="website-label">Message</span><textarea required rows="5" value={form.message} onChange={update('message')} className="website-input h-auto py-3" placeholder="Tell the team how they can assist you." /></label>
            </div>
            <p className="mt-4 text-[10px] leading-4 text-[#817a70]">Review the <Link to="/privacy-policy" className="font-semibold text-[#806014] hover:underline">Privacy Notice</Link> before sending your inquiry.</p>
            {reviewed ? <div className="mt-4 rounded-xl border border-[#d8c486] bg-[#faf5e6] p-4 text-[12px] leading-5 text-[#5d4917]"><p className="font-bold">Your inquiry is ready.</p><p className="mt-1">Open your email app to send the prepared message.</p><a href={mailto} className="website-button-dark mt-3"><FiMail /> Open email</a></div> : null}
            <button className="website-button-dark mt-5 w-full" type="submit">Prepare Email</button>
          </form>
        </div>
      </section>

      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1180px]"><SectionHeading eyebrow="Office location" title="Visit D&C Prime Realty in Indang, Cavite" description={company.address} /><div className="website-map mt-7 aspect-[16/8] min-h-[360px] overflow-hidden rounded-[18px] border border-[#ded9ce] bg-white"><iframe src={company.mapEmbedUrl} title="D&C Prime Realty office location on Google Maps" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></div>
      </section>
    </>
  )
}

export default ContactUs

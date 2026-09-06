import { FiMapPin } from 'react-icons/fi'

const PageHero = ({ eyebrow, title, description, image, location, logo }) => (
  <section className="relative isolate overflow-hidden bg-[#17130a] px-5 py-14 text-white sm:py-16 lg:px-8 lg:py-18">
    {image ? <img src={image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" /> : null}
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17130a] via-[#17130a]/90 to-[#17130a]/40" />
    <div className="mx-auto max-w-[1240px]">
      {logo ? <img src={logo} alt="" className="mb-6 h-16 max-w-[300px] object-contain object-left brightness-0 invert" /> : null}
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#dfbd62]">{eyebrow}</p>
      <h1 className="mt-4 max-w-[900px] text-[34px] leading-[1.15] sm:text-[40px] xl:text-[44px]">{title}</h1>
      <p className="mt-5 max-w-[760px] text-[14px] leading-7 text-[#ded8cd] sm:text-[15px]">{description}</p>
      {location ? <p className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-[#e4c76f]"><FiMapPin /> {location}</p> : null}
    </div>
  </section>
)

export default PageHero


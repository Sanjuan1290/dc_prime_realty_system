import { FiMapPin } from 'react-icons/fi'

const PageHero = ({ eyebrow, title, description, image, location }) => (
  <section className="relative isolate overflow-hidden bg-[#17130a] px-5 py-20 text-white sm:py-24 lg:px-8">
    {image ? <img src={image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" /> : null}
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17130a] via-[#17130a]/90 to-[#17130a]/45" />
    <div className="mx-auto max-w-[1440px]">
      <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#eac14f]">{eyebrow}</p>
      <h1 className="mt-4 max-w-4xl text-[42px] font-black leading-[1.02] tracking-[-0.05em] sm:text-[58px]">{title}</h1>
      <p className="mt-6 max-w-3xl text-[16px] leading-8 text-[#e3dccd]">{description}</p>
      {location ? <p className="mt-6 flex items-center gap-2 text-[13px] font-bold text-[#f3d77f]"><FiMapPin /> {location}</p> : null}
    </div>
  </section>
)

export default PageHero

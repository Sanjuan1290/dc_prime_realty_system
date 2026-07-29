const SectionHeading = ({ eyebrow, title, description, align = 'left', light = false }) => {
  const centered = align === 'center'
  return (
    <div className={`${centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}`}>
      {eyebrow ? <p className={`text-[12px] font-black uppercase tracking-[0.22em] ${light ? 'text-[#eac14f]' : 'text-[#9d7007]'}`}>{eyebrow}</p> : null}
      <h2 className={`mt-3 text-[34px] font-black leading-[1.08] tracking-[-0.04em] sm:text-[44px] ${light ? 'text-white' : 'text-[#18140b]'}`}>{title}</h2>
      {description ? <p className={`mt-5 text-[15px] leading-7 sm:text-[16px] ${light ? 'text-[#ded6c5]' : 'text-[#665d4b]'}`}>{description}</p> : null}
    </div>
  )
}

export default SectionHeading

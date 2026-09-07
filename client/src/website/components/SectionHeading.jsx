const SectionHeading = ({ eyebrow, title, description, align = 'left', light = false }) => {
  const centered = align === 'center'

  return (
    <div className={`${centered ? 'mx-auto max-w-[760px] text-center' : 'max-w-[720px]'}`}>
      {eyebrow ? (
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${light ? 'text-[#dfbd62]' : 'text-[#806014]'}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`mt-3 text-[28px] leading-[1.2] sm:text-[32px] xl:text-[35px] ${light ? 'text-white' : 'text-[#1b1813]'}`}>
        {title}
      </h2>
      {description ? (
        <p className={`mt-4 text-[14px] leading-7 sm:text-[15px] ${light ? 'text-[#d8d1c4]' : 'text-[#666158]'}`}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

export default SectionHeading

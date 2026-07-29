import { useEffect, useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'

const FAQAccordion = ({ items }) => {
  const [openIndex, setOpenIndex] = useState(0)

  useEffect(() => {
    const match = window.location.hash.match(/^#faq-(\d+)$/)
    if (!match) return
    const index = Number(match[1]) - 1
    if (index >= 0 && index < items.length) {
      setOpenIndex(index)
      window.setTimeout(() => document.getElementById(`faq-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    }
  }, [items.length])

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const open = index === openIndex
        return (
          <article id={`faq-${index + 1}`} key={item.question} className="scroll-mt-24 overflow-hidden rounded-[14px] border border-[#ded9ce] bg-white">
            <button type="button" onClick={() => setOpenIndex(open ? -1 : index)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left" aria-expanded={open} aria-controls={`faq-panel-${index + 1}`}>
              <span className="text-[13px] font-semibold text-[#26231e]">{item.question}</span>
              <FiChevronDown className={`h-4 w-4 shrink-0 text-[#806014] transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? <p id={`faq-panel-${index + 1}`} className="border-t border-[#ece7de] px-4 py-4 text-[12px] leading-6 text-[#666158]">{item.answer}</p> : null}
          </article>
        )
      })}
    </div>
  )
}

export default FAQAccordion

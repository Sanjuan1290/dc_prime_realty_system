import { useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'

const FAQAccordion = ({ items }) => {
  const [openIndex, setOpenIndex] = useState(0)
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const open = index === openIndex
        return (
          <article key={item.question} className="overflow-hidden rounded-2xl border border-[#e5dbc4] bg-white">
            <button type="button" onClick={() => setOpenIndex(open ? -1 : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left">
              <span className="text-[15px] font-black text-[#201b11]">{item.question}</span>
              <FiChevronDown className={`h-5 w-5 shrink-0 text-[#a97908] transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? <p className="border-t border-[#eee6d4] px-5 py-5 text-[14px] leading-7 text-[#675f4f]">{item.answer}</p> : null}
          </article>
        )
      })}
    </div>
  )
}

export default FAQAccordion

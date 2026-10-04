import { FiCheck, FiFileText, FiMap, FiMessageCircle, FiSearch, FiUserCheck } from 'react-icons/fi'

const steps = [
  [FiSearch, 'Review projects', 'Compare current locations, status and project information.'],
  [FiMessageCircle, 'Request details', 'Ask for current property options and the latest quotation.'],
  [FiMap, 'Visit the site', 'Check road access, surroundings and actual site conditions.'],
  [FiFileText, 'Review documents', 'Read the payment breakdown and buyer requirements.'],
  [FiUserCheck, 'Choose a property', 'Confirm your preferred unit with an authorized representative.'],
  [FiCheck, 'Complete requirements', 'Follow the official reservation and receipt process.'],
]

const BuyerProcess = () => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {steps.map(([Icon, title, description], index) => (
      <article key={title} className="rounded-[16px] border border-[#ded9ce] bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3ead3] text-[#806014]"><Icon /></span>
          <span className="text-[11px] font-bold text-[#aaa398]">0{index + 1}</span>
        </div>
        <h3 className="mt-4 text-[18px] text-[#1b1813]">{title}</h3>
        <p className="mt-2 text-[12px] leading-5 text-[#6d6960]">{description}</p>
      </article>
    ))}
  </div>
)

export default BuyerProcess

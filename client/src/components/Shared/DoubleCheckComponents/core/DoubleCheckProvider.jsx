import { useEffect, useRef, useState } from 'react'
import { setDoubleCheckHandler } from '../../../../utils/doubleCheck'
import ProjectDoubleCheck from '../ProjectDoubleCheck'
import ListingDoubleCheck from '../ListingDoubleCheck'
import ListingDocumentRequirementsDoubleCheck from '../ListingDocumentRequirementsDoubleCheck'
import ReservationDoubleCheck from '../ReservationDoubleCheck'
import BuyerProfileDoubleCheck from '../BuyerProfileDoubleCheck'
import UserDoubleCheck from '../UserDoubleCheck'
import SellerGroupDoubleCheck from '../SellerGroupDoubleCheck'
import DocumentDoubleCheck from '../DocumentDoubleCheck'
import DocumentTemplateDoubleCheck from '../DocumentTemplateDoubleCheck'
import DocumentUploadDoubleCheck from '../DocumentUploadDoubleCheck'
import PaymentDoubleCheck from '../PaymentDoubleCheck'
import PaymentProofDoubleCheck from '../PaymentProofDoubleCheck'
import SoaTermsDoubleCheck from '../SoaTermsDoubleCheck'
import PenaltyAdjustmentDoubleCheck from '../PenaltyAdjustmentDoubleCheck'
import CommissionReleaseDoubleCheck from '../CommissionReleaseDoubleCheck'
import ProofOfIncomeDoubleCheck from '../ProofOfIncomeDoubleCheck'
import EmployeeDoubleCheck from '../EmployeeDoubleCheck'
import AttendanceDoubleCheck from '../AttendanceDoubleCheck'
import CashAdvanceDoubleCheck from '../CashAdvanceDoubleCheck'
import PayrollReleaseDoubleCheck from '../PayrollReleaseDoubleCheck'
import SettingsDoubleCheck from '../SettingsDoubleCheck'
import BuyerFormDoubleCheck from '../BuyerFormDoubleCheck'
import AuditArchiveDoubleCheck from '../AuditArchiveDoubleCheck'

const components = {
  project: ProjectDoubleCheck,
  listing: ListingDoubleCheck,
  'listing-documents': ListingDocumentRequirementsDoubleCheck,
  reservation: ReservationDoubleCheck,
  'buyer-profile': BuyerProfileDoubleCheck,
  user: UserDoubleCheck,
  'seller-group': SellerGroupDoubleCheck,
  document: DocumentDoubleCheck,
  'document-template': DocumentTemplateDoubleCheck,
  'document-upload': DocumentUploadDoubleCheck,
  payment: PaymentDoubleCheck,
  'payment-proof': PaymentProofDoubleCheck,
  'soa-terms': SoaTermsDoubleCheck,
  'penalty-adjustment': PenaltyAdjustmentDoubleCheck,
  'commission-release': CommissionReleaseDoubleCheck,
  'proof-of-income': ProofOfIncomeDoubleCheck,
  employee: EmployeeDoubleCheck,
  attendance: AttendanceDoubleCheck,
  'cash-advance': CashAdvanceDoubleCheck,
  'payroll-release': PayrollReleaseDoubleCheck,
  settings: SettingsDoubleCheck,
  'buyer-form': BuyerFormDoubleCheck,
  'audit-archive': AuditArchiveDoubleCheck,
}

const DoubleCheckProvider = ({ children }) => {
  const [request, setRequest] = useState(null)
  const resolverRef = useRef(null)

  useEffect(() => setDoubleCheckHandler((nextRequest) => new Promise((resolve) => {
    resolverRef.current = resolve
    setRequest(nextRequest)
  })), [])

  const finish = (confirmed) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    resolve?.(confirmed)
  }

  const ReviewComponent = request ? components[request.type] : null

  return (
    <>
      {children}
      {request && ReviewComponent ? <ReviewComponent request={request} onConfirm={() => finish(true)} onCancel={() => finish(false)} /> : null}
    </>
  )
}

export default DoubleCheckProvider

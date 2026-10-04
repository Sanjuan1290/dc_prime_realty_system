import DocumentUploadDoubleCheck from './DocumentUploadDoubleCheck'

const PaymentProofDoubleCheck = (props) => <DocumentUploadDoubleCheck {...props} request={{ ...props.request, variant: 'payment-proof' }} />

export default PaymentProofDoubleCheck

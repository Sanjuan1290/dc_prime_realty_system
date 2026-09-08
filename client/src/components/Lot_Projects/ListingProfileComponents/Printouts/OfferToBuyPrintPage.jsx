import PrintPageShell from './PrintPageShell'
import OfferToBuyForm from './OfferToBuyForm'
import { readPrintPayload } from './printUtils'

const OfferToBuyPrintPage = () => {
  const { listing = {}, client = {}, soaRows = [] } = readPrintPayload()

  return (
    <PrintPageShell title="Offer To Buy & Buyer&apos;s Profile">
      <OfferToBuyForm listing={listing} client={client} soaRows={soaRows} />
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage


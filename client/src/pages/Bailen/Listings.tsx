import { useMemo, useState } from "react";
import { FiAlertCircle, FiGrid, FiPlus } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import AddListingModal from "../../components/Bailen/ListingsComponent/AddListingModal";
import ListingDetailsModal from "../../components/Bailen/ListingsComponent/ListingDetailsModal";
import ListingRecords from "../../components/Bailen/ListingsComponent/ListingRecords";
import type { Bailen_Lot_Listing } from "../../types/listing";

const createListing = (
  id: number,
  unitCode: string,
  status: Bailen_Lot_Listing["bailen_lot_listing_status"],
  area: number,
  pricePerSqm: number,
  buyerName: string | null,
  sellerName: string | null
): Bailen_Lot_Listing => {
  const netSellingPrice = area * pricePerSqm;
  const lmfRate = 10;
  const lmf = netSellingPrice * (lmfRate / 100);
  const tcp = netSellingPrice + lmf;

  return {
    bailen_lot_listing_id: id,
    client_id: buyerName ? id : null,
    accredited_seller_id: sellerName ? id : null,
    bailen_lot_listing_project_id: 1,
    bailen_lot_listing_unit_id: Number(unitCode.replace("LA-", "")),
    bailen_lot_listing_unit_code: unitCode,
    bailen_lot_listing_old_unit_ids: id === 1 ? ["LA-0204", "LA-0202"] : [],
    bailen_lot_listing_lot_type: id % 3 === 0 ? "corner" : id % 2 === 0 ? "end" : "inner",
    bailen_lot_listing_reservation_fee: 50000,
    bailen_lot_listing_price_sqm: pricePerSqm,
    bailen_lot_listing_lot_area_sqm: area,
    bailen_lot_listing_lot_are_sqm: area,
    bailen_lot_listing_legal_misc_rate: lmfRate,
    bailen_lot_listing_annual_interest_rate: 7.5,
    bailen_lot_listing_net_selling_price: netSellingPrice,
    bailen_lot_listing_legal_misc_fee: lmf,
    bailen_lot_listing_total_contract_price: tcp,
    bailen_lot_listing_status: status,
    bailen_lot_listing_documents: [],
    bailen_lot_listing_client_profile: buyerName
      ? {
          client_id: id,
          buyer_type: "single",
          primary_buyer: {
            full_name: buyerName,
            email: `${buyerName.toLowerCase().replaceAll(" ", ".")}@gmail.com`,
            contact_no: "09XXXXXXXXX",
            address: "Cavite, Philippines",
            birth_date: "1998-01-01",
            place_of_birth: "Cavite",
            citizenship: "Filipino",
            gender: "male",
            civil_status: "Single",
            tin: "000-000-000",
            employment_status: "Employed - Private",
            employer_or_business_name: "Sample Employer",
            monthly_income: 35000,
          },
          second_buyer: null,
          profile_status: "complete",
          saved_at: "2026-07-01",
        }
      : null,
    bailen_lot_listing_payment_terms: buyerName
      ? {
          payment_mode: "installment",
          term_months: 36,
          first_due_date: "2026-07-22",
          reservation_paid: true,
          downpayment_percent: 30,
          downpayment_months: 3,
          monthly_amortization: 35900,
          balance: tcp - 50000,
        }
      : null,
    bailen_lot_listing_commission_snapshot: sellerName
      ? {
          seller_name: sellerName,
          seller_group_name: "SARTE, JOHN CHRISTOPHER GROUP",
          seller_rate_bailen: 3,
          commission_pool_rate_bailen: 12,
          commission_status: "pending",
        }
      : null,
    bailen_lot_listing_created_at: "2026-07-01",
    bailen_lot_listing_updated_at: "2026-07-01",
  };
};

const sampleListings: Bailen_Lot_Listing[] = [
  createListing(1, "LA-0203", "available", 1000, 555, null, null),
  createListing(2, "LA-0204", "reserved", 900, 560, "Robert San Juan", "CANTIGA, ROLINDA C."),
  createListing(3, "LA-0205", "sold", 850, 575, "Juan Dela Cruz", "PARROCHO, JOSEPH E."),
  createListing(4, "LA-0206", "hold", 760, 590, null, "REYES, MARIA L."),
  createListing(5, "LA-0207", "pending for cancellation", 820, 575, "Maria Santos", "CANTIGA, ROLINDA C."),
  createListing(6, "LA-0208", "cancelled", 800, 550, null, null),
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

const Listings = () => {
  const [showAddListingModal, setShowAddListingModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Bailen_Lot_Listing | null>(null);

  const overview = useMemo(
    () => [
      {
        name: "All Listings",
        value: sampleListings.length,
        description: "Total Bailen unit inventory",
      },
      {
        name: "Available",
        value: sampleListings.filter(
          (listing) => listing.bailen_lot_listing_status === "available"
        ).length,
        description: "Ready for reservation",
      },
      {
        name: "Reserved / Sold",
        value: sampleListings.filter((listing) =>
          ["reserved", "sold"].includes(listing.bailen_lot_listing_status)
        ).length,
        description: "With buyer profile",
      },
      {
        name: "Needs Profile",
        value: sampleListings.filter(
          (listing) => !listing.bailen_lot_listing_client_profile
        ).length,
        description: "No client profile yet",
      },
      {
        name: "Hold",
        value: sampleListings.filter(
          (listing) => listing.bailen_lot_listing_status === "hold"
        ).length,
        description: "Temporarily blocked",
      },
      {
        name: "Total Value",
        value: formatMoney(
          sampleListings.reduce(
            (total, listing) =>
              total + listing.bailen_lot_listing_total_contract_price,
            0
          )
        ),
        description: "Inventory TCP",
      },
    ],
    []
  );

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Listings / Units"
          description="Manage Bailen inventory, unit details, client profile, payment terms, and document checklist."
          icon={FiGrid}
        />

        <button
          type="button"
          onClick={() => setShowAddListingModal(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-fit"
        >
          <FiPlus className="h-4 w-4" />
          Add Listing
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {overview.map((item) => (
          <div
            key={item.name}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-bold text-slate-500">{item.name}</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {item.value}
            </h3>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold text-amber-800">
              Client profiles are now handled inside Listings.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Open a unit's Details modal to encode buyer information, seller,
              terms, and documents for that particular listing.
            </p>
          </div>
        </div>
      </div>

      <ListingRecords
        listings={sampleListings}
        onOpenDetails={(listing) => setSelectedListing(listing)}
      />

      {showAddListingModal && (
        <AddListingModal onClose={() => setShowAddListingModal(false)} />
      )}

      {selectedListing && (
        <ListingDetailsModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </main>
  );
};

export default Listings;

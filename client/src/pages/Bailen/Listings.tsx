import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiGrid, FiPlus } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import AddListingModal from "../../components/Bailen/ListingsComponent/AddListingModal";
import ListingRecords from "../../components/Bailen/ListingsComponent/ListingRecords";
import type { Bailen_Lot_Listing } from "../../types/listing";
import { sampleBailenListings } from "./bailenSampleData";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

const Listings = () => {
  const navigate = useNavigate();
  const [showAddListingModal, setShowAddListingModal] = useState(false);

  const overview = useMemo(
    () => [
      {
        name: "All Listings",
        value: sampleBailenListings.length,
        description: "Total Bailen unit inventory",
      },
      {
        name: "Available",
        value: sampleBailenListings.filter(
          (listing) => listing.bailen_lot_listing_status === "available"
        ).length,
        description: "Ready for reservation",
      },
      {
        name: "Hold",
        value: sampleBailenListings.filter(
          (listing) => listing.bailen_lot_listing_status === "hold"
        ).length,
        description: "Temporarily blocked",
      },
      {
        name: "Sold",
        value: sampleBailenListings.filter(
          (listing) => listing.bailen_lot_listing_status === "sold"
        ).length,
        description: "With active buyer profile",
      },
      {
        name: "Cadastral Nos.",
        value: new Set(
          sampleBailenListings.flatMap(
            (listing) => listing.bailen_lot_listing_cadastral_lot_numbers
          )
        ).size,
        description: "Used in visible listings",
      },
      {
        name: "Total Value",
        value: formatMoney(
          sampleBailenListings.reduce(
            (total, listing) =>
              total + listing.bailen_lot_listing_total_contract_price,
            0
          )
        ),
        description: "TCP inventory snapshot",
      },
    ],
    []
  );

  const handleOpenListing = (listing: Bailen_Lot_Listing) => {
    navigate(`/bailenProject/listings/${listing.bailen_lot_listing_id}`);
  };

  return (
    <main className="flex flex-col gap-6">
      {showAddListingModal && (
        <AddListingModal onClose={() => setShowAddListingModal(false)} />
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Listings / Units"
          description="Manage Bailen inventory, cadastral numbers, client profiles, SOA, documents, and payment terms."
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

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="font-bold text-blue-900">Client profile is per listing</p>
            <p className="mt-1 text-sm leading-6 text-blue-700">
              A buyer can purchase multiple units, but the client profile is encoded inside each specific listing page.
              Click Open to manage the bigger workspace for Unit Status, Client Profile, Payments & SOA, Documents, and Printouts.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {overview.map((item) => (
          <div
            key={item.name}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-bold text-slate-500">{item.name}</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {item.value}
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      <ListingRecords
        listings={sampleBailenListings}
        onOpenDetails={handleOpenListing}
      />
    </main>
  );
};

export default Listings;

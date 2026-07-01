import { useMemo, useState } from "react";
import { FaCircle } from "react-icons/fa6";
import { FiEye, FiSearch } from "react-icons/fi";
import type {
  BailenListingStatus,
  Bailen_Lot_Listing,
} from "../../../types/listing";

type Props = {
  listings: Bailen_Lot_Listing[];
  onOpenDetails: (listing: Bailen_Lot_Listing) => void;
};

const statusOptions: ("all" | BailenListingStatus)[] = [
  "all",
  "available",
  "hold",
  "reserved",
  "sold",
  "pending for cancellation",
  "cancelled",
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const getStatusClass = (status: BailenListingStatus) => {
  if (status === "available") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "hold") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "reserved" || status === "sold") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "pending for cancellation") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-red-200 bg-red-50 text-red-700";
};

const ListingRecords = ({ listings, onOpenDetails }: Props) => {
  const [search, setSearch] = useState("");
  const [lotTypeFilter, setLotTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BailenListingStatus>("all");
  const [page, setPage] = useState(1);

  const pageSize = 5;

  const filteredListings = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return listings.filter((listing) => {
      const buyerName =
        listing.bailen_lot_listing_client_profile?.primary_buyer.full_name.toLowerCase() ??
        "";
      const sellerName =
        listing.bailen_lot_listing_commission_snapshot?.seller_name?.toLowerCase() ??
        "";
      const cadastralNumbers =
        listing.bailen_lot_listing_cadastral_lot_numbers.join(" ").toLowerCase();

      const matchesSearch =
        !keyword ||
        listing.bailen_lot_listing_unit_code.toLowerCase().includes(keyword) ||
        listing.bailen_lot_listing_old_unit_ids.join(" ").toLowerCase().includes(keyword) ||
        cadastralNumbers.includes(keyword) ||
        buyerName.includes(keyword) ||
        sellerName.includes(keyword);

      const matchesLotType =
        lotTypeFilter === "all" ||
        listing.bailen_lot_listing_lot_type === lotTypeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        listing.bailen_lot_listing_status === statusFilter;

      return matchesSearch && matchesLotType && matchesStatus;
    });
  }, [listings, lotTypeFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedListings = filteredListings.slice(pageStart, pageStart + pageSize);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Bailen Unit Records</h2>
          <p className="text-sm text-slate-500">
            Open the listing page to manage unit details, client profile, payments, SOA, documents, and printouts.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_150px_180px]">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search unit, buyer, cadastral, old ID, or seller"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
            />
          </label>

          <select
            value={lotTypeFilter}
            onChange={(event) => {
              setLotTypeFilter(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Lot Types</option>
            <option value="inner">Inner</option>
            <option value="corner">Corner</option>
            <option value="end">End</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | BailenListingStatus);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All Status" : status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1550px]">
          <div className="grid grid-cols-[0.85fr_0.85fr_1fr_0.75fr_0.8fr_0.95fr_0.95fr_0.95fr_1fr_0.8fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <p>Unit</p>
            <p>Cadastral</p>
            <p>Old IDs</p>
            <p>Type</p>
            <p>Area</p>
            <p>Price / SQM</p>
            <p>TCP</p>
            <p>Buyer</p>
            <p>Status</p>
            <p className="text-right">Action</p>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedListings.map((listing) => {
              const profile = listing.bailen_lot_listing_client_profile;
              const hasClient = Boolean(profile);
              const statusClass = getStatusClass(
                listing.bailen_lot_listing_status
              );

              return (
                <div
                  key={listing.bailen_lot_listing_id}
                  className="grid grid-cols-[0.85fr_0.85fr_1fr_0.75fr_0.8fr_0.95fr_0.95fr_0.95fr_1fr_0.8fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-bold text-slate-950">
                      {listing.bailen_lot_listing_unit_code}
                    </p>
                    <p className="text-xs text-slate-500">
                      ID: {listing.bailen_lot_listing_id}
                    </p>
                  </div>

                  <p className="font-semibold text-slate-700">
                    {listing.bailen_lot_listing_cadastral_lot_numbers.join(", ") || "-"}
                  </p>

                  <p className="font-medium text-slate-600">
                    {listing.bailen_lot_listing_old_unit_ids.join(", ") || "-"}
                  </p>

                  <p className="capitalize text-slate-700">
                    {listing.bailen_lot_listing_lot_type}
                  </p>

                  <p className="font-semibold text-slate-700">
                    {listing.bailen_lot_listing_lot_area_sqm.toLocaleString()} sqm
                  </p>

                  <p className="font-semibold text-slate-700">
                    {formatMoney(listing.bailen_lot_listing_price_sqm)}
                  </p>

                  <p className="font-bold text-slate-950">
                    {formatMoney(listing.bailen_lot_listing_total_contract_price)}
                  </p>

                  <div>
                    <p className="font-semibold text-slate-800">
                      {profile?.primary_buyer.full_name || "No client yet"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {hasClient ? "Profile saved" : "Available for reservation"}
                    </p>
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusClass}`}
                    >
                      <FaCircle className="h-2 w-2" />
                      {listing.bailen_lot_listing_status}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(listing)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      Open
                    </button>
                  </div>
                </div>
              );
            })}

            {paginatedListings.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="font-bold text-slate-700">No listings found.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing the search or filters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Showing {filteredListings.length === 0 ? 0 : pageStart + 1}-
          {Math.min(pageStart + pageSize, filteredListings.length)} of{" "}
          {filteredListings.length} records
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((prevPage) => Math.max(1, prevPage - 1))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Previous
          </button>

          <span className="h-9 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((prevPage) => Math.min(totalPages, prevPage + 1))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default ListingRecords;

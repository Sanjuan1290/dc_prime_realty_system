import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import ReadOnlyNotice from "../../components/Shared/ReadOnlyNotice";
import useCurrentUser from "../../utils/useCurrentUser";
import { FaUserPlus } from "react-icons/fa";
import { FiCalendar, FiFileText, FiLoader, FiPrinter, FiRefreshCw, FiSearch, FiUsers, FiX } from "react-icons/fi";
import { formatDateTime } from "../../utils/formatDateTime";
import { useFetch as fetchApi, useFetchPost as postApi } from "../../utils/useFetch";

const EMPTY_LIST = [];

const roleLabels = {
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const SellerRatesCell = ({ rates = [] }) => {
  if (!rates.length) return <p className="text-xs font-semibold text-slate-500">No rates</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {rates.map((rate) => (
        <span key={rate.lot_project_id} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
          {rate.lot_project_location_code || rate.lot_project_name}: {Number(rate.accredited_seller_project_rate || 0).toFixed(2)}%
        </span>
      ))}
    </div>
  );
};

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const todayISO = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const shiftIsoDateYears = (isoDate, yearOffset) => {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  const date = new Date(Date.UTC(year + yearOffset, month - 1, day));

  // Clamp leap-day changes to the last valid day of the target month.
  if (date.getUTCMonth() !== month - 1) {
    date.setUTCDate(0);
  }

  return date.toISOString().slice(0, 10);
};

const getIncomeRangePreset = (preset) => {
  const endDate = todayISO();
  const [year, month] = endDate.split("-");

  if (preset === "month") return { startDate: `${year}-${month}-01`, endDate };
  if (preset === "year") return { startDate: `${year}-01-01`, endDate };
  return { startDate: shiftIsoDateYears(endDate, -1), endDate };
};

const titleCase = (value) =>
  String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const IncomeRangeReportPanel = ({ seller, sellerId, receipts = EMPTY_LIST, receiptsLoading = false, receiptsError = null }) => {
  const defaultRange = useMemo(() => getIncomeRangePreset("last12"), []);
  const [rangeForm, setRangeForm] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [rangeAlert, setRangeAlert] = useState(null);

  const rangeQuery = useQuery({
    queryKey: ["seller-income-range", sellerId, appliedRange.startDate, appliedRange.endDate],
    queryFn: () => {
      const query = new URLSearchParams(appliedRange).toString();
      return fetchApi(`/accredited/${sellerId}/income-range?${query}`);
    },
    enabled: sellerId > 0,
  });

  const report = rangeQuery.data?.data || null;
  const entries = report?.entries || EMPTY_LIST;
  const summary = report?.summary || {
    releaseCount: 0,
    propertyCount: 0,
    grossIncome: 0,
    deductions: 0,
    netIncome: 0,
  };
  const reportSeller = report?.seller || seller || {};
  const matchingReceiptIds = useMemo(
    () => new Set(entries.filter((entry) => entry.receiptId).map((entry) => Number(entry.receiptId))),
    [entries]
  );
  const receiptsInRange = useMemo(
    () => receipts.filter((receipt) =>
      receipt?.status !== "void" && matchingReceiptIds.has(Number(receipt.receiptId))
    ),
    [matchingReceiptIds, receipts]
  );
  const unreceiptedReleaseCount = Math.max(
    Number(summary.releaseCount || 0) - Number(summary.receiptedReleaseCount || 0),
    0
  );

  const updateRange = (key, value) => {
    setRangeForm((current) => ({ ...current, [key]: value }));
    if (rangeAlert?.type === "error") setRangeAlert(null);
  };

  const loadRange = () => {
    if (!rangeForm.startDate || !rangeForm.endDate) {
      setRangeAlert({ type: "error", message: "Select both a start date and an end date." });
      return;
    }

    if (rangeForm.startDate > rangeForm.endDate) {
      setRangeAlert({ type: "error", message: "Start date cannot be after end date." });
      return;
    }

    setRangeAlert(null);
    const unchanged =
      appliedRange.startDate === rangeForm.startDate &&
      appliedRange.endDate === rangeForm.endDate;

    if (unchanged) rangeQuery.refetch();
    else setAppliedRange({ ...rangeForm });
  };

  const applyPreset = (preset) => {
    const nextRange = getIncomeRangePreset(preset);
    setRangeForm(nextRange);
    setRangeAlert(null);

    const unchanged =
      appliedRange.startDate === nextRange.startDate &&
      appliedRange.endDate === nextRange.endDate;

    if (unchanged) rangeQuery.refetch();
    else setAppliedRange(nextRange);
  };

  const printRangeReport = () => {
    if (!report || !entries.length) {
      setRangeAlert({ type: "warning", message: "There are no released income entries in this date range." });
      return;
    }

    if (!receiptsInRange.length) {
      setRangeAlert({
        type: "warning",
        message: "No generated acknowledgement receipts are available in this date range. Generate the receipts first, then use Print All.",
      });
      return;
    }

    // Print All reuses the exact single-receipt layout. Every generated receipt
    // starts on its own A4 page, so one print job can be saved as one PDF.
    localStorage.setItem(
      "accredited_seller_income_range_payload",
      JSON.stringify({
        seller: reportSeller,
        range: report.range || appliedRange,
        receipts: receiptsInRange,
        generatedAt: report.generatedAt,
      })
    );
    window.open("/super_admin/accredited/proof-of-income/range/print", "_blank");
  };

  return (
    <section aria-busy={rangeQuery.isFetching}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-950">Income date range</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Income is based on each commission stage’s actual release date. Print All repeats the generated acknowledgement receipt layout for matching receipts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset("month")} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100">This Month</button>
            <button type="button" onClick={() => applyPreset("year")} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100">This Year</button>
            <button type="button" onClick={() => applyPreset("last12")} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100">Last 12 Months</button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">From Date</span>
            <input type="date" max={todayISO()} value={rangeForm.startDate} onChange={(event) => updateRange("startDate", event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">To Date</span>
            <input type="date" max={todayISO()} value={rangeForm.endDate} onChange={(event) => updateRange("endDate", event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>
          <button type="button" onClick={loadRange} disabled={rangeQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {rangeQuery.isFetching ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSearch className="h-4 w-4" />}
            {rangeQuery.isFetching ? "Loading..." : "Load Income"}
          </button>
        </div>
      </div>

      {rangeAlert ? <StatusAlert type={rangeAlert.type} message={rangeAlert.message} onClose={() => setRangeAlert(null)} className="mt-4" /> : null}
      {rangeQuery.isLoading ? <StatusAlert type="loading" message="Loading released income for the selected date range..." className="mt-4" /> : null}
      {rangeQuery.isError ? <StatusAlert type="error" message={rangeQuery.error?.message || "Failed to load the income range report."} className="mt-4" /> : null}
      {rangeQuery.isFetching && !rangeQuery.isLoading ? <StatusAlert type="loading" message="Refreshing income entries..." className="mt-4" /> : null}
      {receiptsLoading ? <StatusAlert type="loading" message="Loading generated acknowledgement receipts for Print All..." className="mt-4" /> : null}
      {receiptsError ? <StatusAlert type="error" message={receiptsError?.message || "Failed to load generated acknowledgement receipts."} className="mt-4" /> : null}
      {!receiptsLoading && !receiptsError && report && unreceiptedReleaseCount > 0 ? (
        <StatusAlert
          type="warning"
          message={`${unreceiptedReleaseCount} released income entr${unreceiptedReleaseCount === 1 ? "y has" : "ies have"} no generated acknowledgement receipt and will not be included in Print All.`}
          className="mt-4"
        />
      ) : null}

      {!rangeQuery.isLoading && !rangeQuery.isError && report ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Released Entries", summary.releaseCount],
              ["Generated Receipts", receiptsInRange.length],
              ["Properties", summary.propertyCount],
              ["Gross Income", money(summary.grossIncome)],
              ["Deductions", money(summary.deductions)],
              ["Net Income", money(summary.netIncome)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`mt-2 text-xl font-black ${label === "Net Income" ? "text-emerald-700" : "text-slate-950"}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-black text-slate-950">Released income entries</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {reportSeller.full_name || seller?.full_name || "Seller"} · {appliedRange.startDate} to {appliedRange.endDate}
              </p>
            </div>
            <button
              type="button"
              onClick={printRangeReport}
              disabled={!entries.length || !receiptsInRange.length || receiptsLoading}
              title={!receiptsInRange.length ? "Generate acknowledgement receipts before printing them together." : "Print all matching acknowledgement receipts in one PDF."}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {receiptsLoading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPrinter className="h-4 w-4" />}
              {receiptsLoading ? "Loading Receipts..." : `Print All Receipts (${receiptsInRange.length})`}
            </button>
          </div>

          {entries.length ? (
            <>
              <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
                <table className="min-w-[1050px] w-full border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Release Date</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Buyer</th>
                      <th className="px-4 py-3">Income Type</th>
                      <th className="px-4 py-3">Release</th>
                      <th className="px-4 py-3 text-right">Gross</th>
                      <th className="px-4 py-3 text-right">Deductions</th>
                      <th className="px-4 py-3 text-right">Net Income</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry) => (
                      <tr key={entry.releaseId} className="align-top">
                        <td className="px-4 py-3 font-black text-slate-900">{entry.releaseDate || "-"}</td>
                        <td className="px-4 py-3"><p className="font-black text-slate-800">{entry.projectName} · {entry.unitId}</p><p className="text-xs font-semibold text-slate-500">{entry.projectLocation || "-"}</p></td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{entry.buyerName || "-"}</td>
                        <td className="px-4 py-3"><p className="font-black text-slate-800">{titleCase(entry.commissionRateType)}</p><p className="text-xs font-semibold text-slate-500">{roleLabels[entry.commissionRole] || titleCase(entry.commissionRole)} · {Number(entry.commissionRate || 0).toFixed(2)}%</p></td>
                        <td className="px-4 py-3"><p className="font-black text-slate-800">{entry.releaseStage}</p><p className="text-xs font-semibold text-slate-500">{Number(entry.releasePercent || 0).toFixed(2)}%{entry.receiptReference ? ` · Receipt ${entry.receiptReference}` : ""}</p></td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{money(entry.grossAmount)}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600">{money(entry.deductionAmount)}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700">{money(entry.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-3 lg:hidden">
                {entries.map((entry) => (
                  <article key={entry.releaseId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{entry.projectName} · {entry.unitId}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Released {entry.releaseDate || "-"}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{money(entry.netAmount)}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div><dt className="font-black uppercase tracking-wide text-slate-400">Buyer</dt><dd className="mt-1 font-semibold text-slate-700">{entry.buyerName || "-"}</dd></div>
                      <div><dt className="font-black uppercase tracking-wide text-slate-400">Income</dt><dd className="mt-1 font-semibold text-slate-700">{titleCase(entry.commissionRateType)} · {Number(entry.commissionRate || 0).toFixed(2)}%</dd></div>
                      <div><dt className="font-black uppercase tracking-wide text-slate-400">Release</dt><dd className="mt-1 font-semibold text-slate-700">{entry.releaseStage}</dd></div>
                      <div><dt className="font-black uppercase tracking-wide text-slate-400">Deductions</dt><dd className="mt-1 font-semibold text-rose-600">{money(entry.deductionAmount)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
              <FiFileText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-black text-slate-700">No released income in this date range</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Choose another date range and load the report again.</p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};

const ProofOfIncomeReceiptModal = ({ seller, onClose, onGenerated }) => {
  const queryClient = useQueryClient();
  const sellerId = Number(seller?.accredited_seller_id || 0);
  const [selectedCommissionId, setSelectedCommissionId] = useState("");
  const [selectedReleaseIds, setSelectedReleaseIds] = useState([]);
  const [form, setForm] = useState({
    bankName: "",
    accountNumber: "",
    receiptDate: todayISO(),
    referenceNumber: "",
    witnessName: "",
  });
  const [localAlert, setLocalAlert] = useState(null);
  const [activeMode, setActiveMode] = useState("receipt");

  const receiptQuery = useQuery({
    queryKey: ["seller-proof-of-income-receipts", sellerId],
    queryFn: () => fetchApi(`/accredited/${sellerId}/proof-of-income-receipts`),
    enabled: sellerId > 0,
  });

  const payload = receiptQuery.data?.data || {};
  const availableGroups = payload.availableGroups || EMPTY_LIST;
  const receipts = payload.receipts || EMPTY_LIST;
  const receiptSeller = payload.seller || seller || {};

  const explicitlySelectedGroup = useMemo(
    () => availableGroups.find((group) => String(group.commissionId) === String(selectedCommissionId)) || null,
    [availableGroups, selectedCommissionId]
  );
  const selectedGroup = explicitlySelectedGroup || availableGroups[0] || null;
  const effectiveReleaseIds = useMemo(
    () => explicitlySelectedGroup
      ? selectedReleaseIds
      : (selectedGroup?.releases || []).map((release) => Number(release.releaseId)),
    [explicitlySelectedGroup, selectedGroup, selectedReleaseIds]
  );

  const selectedAmount = useMemo(() => {
    if (!selectedGroup) return 0;
    const ids = new Set(effectiveReleaseIds.map(Number));
    return selectedGroup.releases
      .filter((release) => ids.has(Number(release.releaseId)))
      .reduce((sum, release) => sum + Number(release.amount || 0), 0);
  }, [effectiveReleaseIds, selectedGroup]);

  const printReceipt = (receipt) => {
    localStorage.setItem(
      "accredited_seller_proof_payload",
      JSON.stringify({ seller: receiptSeller, receipt })
    );
    window.open("/super_admin/accredited/proof-of-income/print", "_blank");
  };


  const createReceiptMutation = useMutation({
    mutationFn: (body) => postApi(`/accredited/${sellerId}/proof-of-income-receipts`, body),
    onMutate: () => setLocalAlert({ type: "loading", message: "Generating proof of income receipt..." }),
    onSuccess: (result) => {
      setLocalAlert({ type: "success", message: result?.message || "Proof of income receipt generated." });
      queryClient.setQueryData(["seller-proof-of-income-receipts", sellerId], result?.data ? { success: true, data: result.data } : undefined);
      queryClient.invalidateQueries({ queryKey: ["seller-proof-of-income-receipts", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
      onGenerated?.(result);
      if (result?.receipt) printReceipt(result.receipt);
    },
    onError: (error) => {
      setLocalAlert({ type: "error", message: error?.message || "Failed to generate proof of income receipt." });
    },
  });

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (localAlert?.type === "error") setLocalAlert(null);
  };

  const chooseGroup = (group) => {
    setSelectedCommissionId(String(group.commissionId));
    setSelectedReleaseIds(group.releases.map((release) => Number(release.releaseId)));
    setLocalAlert(null);
  };

  const toggleRelease = (releaseId) => {
    if (!selectedGroup) return;

    const id = Number(releaseId);
    const currentIds = effectiveReleaseIds.map(Number);
    setSelectedCommissionId(String(selectedGroup.commissionId));
    setSelectedReleaseIds(
      currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id]
    );
  };

  const handleGenerate = () => {
    if (!selectedGroup) {
      setLocalAlert({ type: "warning", message: "No released commission is available for a new receipt." });
      return;
    }
    if (!effectiveReleaseIds.length) {
      setLocalAlert({ type: "error", message: "Select at least one released commission stage." });
      return;
    }

    createReceiptMutation.mutate({
      commissionId: Number(selectedGroup.commissionId),
      releaseIds: effectiveReleaseIds,
      ...form,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Print Proof of Income</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {receiptSeller.full_name || seller.full_name} · {activeMode === "range" ? "Review released income and print matching acknowledgement receipts in one PDF." : "Combine released stages from one property into one receipt."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={createReceiptMutation.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" aria-label="Close proof of income modal">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button type="button" onClick={() => { setActiveMode("receipt"); setLocalAlert(null); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${activeMode === "receipt" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/70"}`}>
              <FiFileText className="h-4 w-4" /> Single Receipt
            </button>
            <button type="button" onClick={() => { setActiveMode("range"); setLocalAlert(null); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${activeMode === "range" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/70"}`}>
              <FiCalendar className="h-4 w-4" /> Income Range Report
            </button>
          </div>

          {activeMode === "range" ? (
            <IncomeRangeReportPanel
              seller={receiptSeller}
              sellerId={sellerId}
              receipts={receipts}
              receiptsLoading={receiptQuery.isLoading}
              receiptsError={receiptQuery.isError ? receiptQuery.error : null}
            />
          ) : (
            <>
          {receiptQuery.isLoading ? <StatusAlert type="loading" message="Loading released commissions and receipt history..." /> : null}
          {receiptQuery.isError ? <StatusAlert type="error" message={receiptQuery.error?.message || "Failed to load proof of income records."} /> : null}
          {localAlert ? <StatusAlert type={localAlert.type} message={localAlert.message} onClose={localAlert.type === "loading" ? undefined : () => setLocalAlert(null)} className="mb-4" /> : null}

          {!receiptQuery.isLoading && !receiptQuery.isError ? (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-950">Released commissions not yet receipted</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Each card represents one seller commission for one buyer and unit.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{availableGroups.length} group{availableGroups.length === 1 ? "" : "s"}</span>
                </div>

                <div className="mt-4 grid gap-3">
                  {availableGroups.length ? availableGroups.map((group) => {
                    const active = String(group.commissionId) === String(selectedCommissionId);
                    return (
                      <button key={group.commissionId} type="button" onClick={() => chooseGroup(group)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-blue-400 bg-blue-50 ring-4 ring-blue-50" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"}`}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-black text-slate-950">{group.projectName} · {group.unitId}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-600">Buyer: {group.buyerName || "-"}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{roleLabels[group.commissionRole] || group.commissionRole} · {Number(group.commissionRate || 0).toFixed(2)}%</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Available amount</p>
                            <p className="mt-1 text-lg font-black text-emerald-700">{money(group.totalAmount)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-500">
                      No released commission stages are waiting for a receipt.
                    </div>
                  )}
                </div>

                {selectedGroup ? (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <h4 className="font-black text-slate-950">Stages to include</h4>
                      <p className="text-xs font-semibold text-slate-500">Selected stages are summed automatically.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedGroup.releases.map((release) => (
                        <label key={release.releaseId} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                          <span className="flex min-w-0 items-center gap-3">
                            <input type="checkbox" checked={effectiveReleaseIds.includes(Number(release.releaseId))} onChange={() => toggleRelease(release.releaseId)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                            <span>
                              <span className="block font-black text-slate-800">{release.stage}</span>
                              <span className="block text-xs font-semibold text-slate-500">Released {release.actualReleaseDate || "-"}</span>
                            </span>
                          </span>
                          <span className="shrink-0 font-black text-slate-950">{money(release.amount)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 bg-emerald-50 px-4 py-3">
                      <span className="text-sm font-black text-emerald-800">Receipt total</span>
                      <span className="text-xl font-black text-emerald-900">{money(selectedAmount)}</span>
                    </div>
                  </div>
                ) : null}
              </section>

              <section>
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-base font-black text-slate-950">Receipt details</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">The amount comes from the selected released stages.</p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <label className="grid gap-1.5"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Bank</span><input value={form.bankName} onChange={(event) => updateForm("bankName", event.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="BPI" /></label>
                    <label className="grid gap-1.5"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Account No.</span><input value={form.accountNumber} onChange={(event) => updateForm("accountNumber", event.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="Account number" /></label>
                    <label className="grid gap-1.5"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Date</span><input type="date" value={form.receiptDate} onChange={(event) => updateForm("receiptDate", event.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
                    <label className="grid gap-1.5"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Reference No.</span><input value={form.referenceNumber} onChange={(event) => updateForm("referenceNumber", event.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="Bank reference" /></label>
                    <label className="grid gap-1.5 sm:col-span-2 xl:col-span-1"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Witness Name</span><input value={form.witnessName} onChange={(event) => updateForm("witnessName", event.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="Printed witness name" /></label>
                  </div>

                  <button type="button" onClick={handleGenerate} disabled={!selectedGroup || !effectiveReleaseIds.length || createReceiptMutation.isPending} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                    {createReceiptMutation.isPending ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPrinter className="h-4 w-4" />}
                    {createReceiptMutation.isPending ? "Generating..." : `Generate & Print ${money(selectedAmount)}`}
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {!receiptQuery.isLoading && !receiptQuery.isError ? (
            <section className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-950">Generated receipt history</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">A released stage cannot be placed on another receipt.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{receipts.length} receipt{receipts.length === 1 ? "" : "s"}</span>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-[900px] w-full border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Date / Reference</th><th className="px-4 py-3">Property</th><th className="px-4 py-3">Included Releases</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.length ? receipts.map((receipt) => (
                      <tr key={receipt.receiptId}>
                        <td className="px-4 py-3"><p className="font-black text-slate-900">{receipt.receiptDate}</p><p className="text-xs font-semibold text-slate-500">{receipt.referenceNumber}</p></td>
                        <td className="px-4 py-3"><p className="font-black text-slate-800">{receipt.projectName} · {receipt.unitId}</p><p className="text-xs font-semibold text-slate-500">{receipt.buyerName || "-"}</p></td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{(receipt.releases || []).map((release) => <span key={release.releaseId} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{release.stage}</span>)}</div></td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700">{money(receipt.totalAmount)}</td>
                        <td className="px-4 py-3 text-right"><button type="button" onClick={() => printReceipt(receipt)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100"><FiPrinter className="h-4 w-4" />Print</button></td>
                      </tr>
                    )) : <tr><td colSpan="5" className="px-4 py-8 text-center font-semibold text-slate-500">No generated receipts yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={createReceiptMutation.isPending} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Close</button>
        </div>
      </div>
    </div>
  );
};

const Accredited = () => {
  const { data: currentUserData } = useCurrentUser();
  const canManage = currentUserData?.user?.role === "super_admin";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [alert, setAlert] = useState(null);
  const [proofSeller, setProofSeller] = useState(null);

  const queryString = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(roleFilter !== "all" ? { role: roleFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  }).toString();

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["accredited", queryString],
    queryFn: () => fetchApi(`/accredited?${queryString}`),
    keepPreviousData: true,
  });


  const sellers = data?.data || [];
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
  const summary = data?.summary || {
    total: 0,
    active: 0,
    inactive: 0,
    roleBreakdown: { broker_network_manager: 0, broker: 0, manager: 0, agent: 0 },
  };

  const roleBreakdown = [
    { label: "BNM", value: summary.roleBreakdown.broker_network_manager, description: "Broker Network Manager" },
    { label: "Brokers", value: summary.roleBreakdown.broker, description: "Broker group leaders" },
    { label: "Managers", value: summary.roleBreakdown.manager, description: "Unit managers" },
    { label: "Agents", value: summary.roleBreakdown.agent, description: "Frontline sellers" },
  ];

  const handlePrintProof = (seller) => {
    setProofSeller(seller);
  };

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Accredited Sellers" description="Seller directory, project rates, and commission release receipts." icon={FaUserPlus} />

      {!canManage ? <ReadOnlyNotice message="Admin can review accredited sellers, reporting chains, and project rates. Proof-of-income receipt creation is restricted to Super Admin." /> : null}
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === "loading" ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading accredited sellers..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing accredited sellers..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || "Failed to load accredited sellers."} /> : null}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.5fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Total Sellers</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.total}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiUsers className="h-5 w-5" /></span></div><p className="mt-3 text-sm text-slate-500">All accredited seller records</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Active</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.active}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiUsers className="h-5 w-5" /></span></div><p className="mt-3 text-sm text-slate-500">Can be assigned to clients</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Inactive</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.inactive}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FiUsers className="h-5 w-5" /></span></div><p className="mt-3 text-sm text-slate-500">Currently restricted</p></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {roleBreakdown.map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">{item.label}</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{item.value}</h3><p className="mt-3 text-sm text-slate-500">{item.description}</p></div>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-lg font-bold text-slate-950">Seller Directory</h2><p className="text-sm text-slate-500">View reporting chain, group assignment, project rates, and commission receipts.</p></div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search sellers..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Roles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["accredited"] })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>

        <div className="overflow-x-auto"><div className="min-w-[1420px]">
          <div className="grid grid-cols-[1.35fr_0.95fr_1.1fr_1.1fr_1.95fr_0.9fr_1.35fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><p>Seller</p><p>Role</p><p>Group</p><p>Reports Under</p><p>Project Rates</p><p>Status / Updated</p><p>Actions</p></div>
          <div className="divide-y divide-slate-100">
            {isLoading ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading accredited sellers...</div> : sellers.length === 0 ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No accredited sellers found.</div> : sellers.map((seller) => {
              return (
                <div key={seller.accredited_seller_id} className="grid grid-cols-[1.35fr_0.95fr_1.1fr_1.1fr_1.95fr_0.9fr_1.35fr] items-center px-4 py-4 text-sm">
                  <div><p className="font-bold text-slate-950">{seller.full_name}</p><p className="text-xs text-slate-500">{seller.email} • {seller.contact_no || "No contact"}</p></div>
                  <p className="font-semibold text-slate-700">{roleLabels[seller.role] || seller.role}</p>
                  <p className="font-semibold text-slate-700">{seller.seller_group_name || "No group"}</p>
                  <p className="text-slate-600">{seller.reports_under_name || "Direct to Developer"}</p>
                  <SellerRatesCell rates={seller.project_rates} />
                  <div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${seller.accredited_seller_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{seller.accredited_seller_status}</span><p className="mt-1 text-xs text-slate-500">{seller.accredited_seller_updated_at ? formatDateTime(seller.accredited_seller_updated_at) : "—"}</p></div>
                  <div className="flex flex-wrap gap-2">{canManage ? <button type="button" onClick={() => handlePrintProof(seller)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Print Proof of Income</button> : <span className="text-xs font-semibold text-slate-400">View only</span>}</div>
                </div>
              );
            })}
          </div>
        </div></div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm font-semibold text-slate-500">Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} records</p><div className="flex items-center gap-2"><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
      </section>

      {proofSeller && canManage ? (
        <ProofOfIncomeReceiptModal
          seller={proofSeller}
          onClose={() => setProofSeller(null)}
          onGenerated={(result) => setAlert({ type: "success", message: result?.message || "Proof of income receipt generated." })}
        />
      ) : null}
    </main>
  );
};

export default Accredited;


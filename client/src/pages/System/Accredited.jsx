import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import { FaUserPlus } from "react-icons/fa";
import { FiFileText, FiLoader, FiPrinter, FiRefreshCw, FiSearch, FiUploadCloud, FiUsers, FiX } from "react-icons/fi";
import { formatDateTime } from "../../utils/formatDateTime";
import { useFetch, useFetchPost } from "../../utils/useFetch";

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

const ProofStatusCell = ({ document }) => {
  if (!document) {
    return (
      <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        Missing
      </span>
    );
  }

  return (
    <div>
      <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        Uploaded
      </span>
      <p className="mt-1 max-w-[150px] truncate text-xs font-semibold text-slate-500">
        {document.fileName || document.file_name || "Proof of income"}
      </p>
    </div>
  );
};

const ProofOfIncomeUploadModal = ({ seller, isSaving = false, onClose, onSave }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const readFileAsDataUrl = (selectedFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => reject(new Error("Failed to read selected file."));
      reader.readAsDataURL(selectedFile);
    });

  const handleSave = async () => {
    if (!file || isSaving) return;

    setError("");

    try {
      const fileUrl = await readFileAsDataUrl(file);
      onSave?.({
        sellerId: seller.accredited_seller_id,
        payload: {
          fileName: file.name,
          fileUrl,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
      });
    } catch (readError) {
      setError(readError?.message || "Failed to read selected file.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Upload Proof of Income</h2>
            <p className="text-sm font-semibold text-slate-500">{seller.full_name}</p>
          </div>

          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 w-10 rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close upload proof modal">
            <FiX className="mx-auto" />
          </button>
        </div>

        <div className="p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center transition hover:bg-blue-100/60">
            <FiUploadCloud className="h-10 w-10 text-blue-600" />
            <span className="mt-3 text-sm font-black text-blue-800">Choose proof of income file</span>
            <span className="mt-1 text-xs font-semibold text-blue-700">PDF, image, or scanned document</span>
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              disabled={isSaving}
              onChange={(event) => {
                setError("");
                setFile(event.target.files?.[0] || null);
              }}
            />
          </label>

          {file ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <FiFileText className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <p className="truncate font-black text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">{file.type || "Unknown type"} · {(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : null}

          {error ? <StatusAlert type="error" message={error} className="mt-3" /> : null}
          {isSaving ? <StatusAlert type="loading" message="Uploading proof of income..." className="mt-3" /> : null}

          <p className="mt-3 text-xs font-semibold text-slate-500">
            The file is saved with preview data, so image proof of income documents can be printed later.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-2xl border px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60">
            Cancel
          </button>

          <button type="button" onClick={handleSave} disabled={!file || isSaving} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Uploading..." : "Save Upload"}
          </button>
        </div>
      </div>
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

  const receiptQuery = useQuery({
    queryKey: ["seller-proof-of-income-receipts", sellerId],
    queryFn: () => useFetch(`/accredited/${sellerId}/proof-of-income-receipts`),
    enabled: sellerId > 0,
  });

  const payload = receiptQuery.data?.data || {};
  const availableGroups = payload.availableGroups || EMPTY_LIST;
  const receipts = payload.receipts || EMPTY_LIST;
  const receiptSeller = payload.seller || seller || {};

  const selectedGroup = useMemo(
    () => availableGroups.find((group) => String(group.commissionId) === String(selectedCommissionId)) || null,
    [availableGroups, selectedCommissionId]
  );

  useEffect(() => {
    if (!availableGroups.length) {
      setSelectedCommissionId("");
      setSelectedReleaseIds([]);
      return;
    }

    const current = availableGroups.find((group) => String(group.commissionId) === String(selectedCommissionId));
    const next = current || availableGroups[0];
    setSelectedCommissionId(String(next.commissionId));
    setSelectedReleaseIds(next.releases.map((release) => Number(release.releaseId)));
  }, [availableGroups, selectedCommissionId]);

  const selectedAmount = useMemo(() => {
    if (!selectedGroup) return 0;
    const ids = new Set(selectedReleaseIds.map(Number));
    return selectedGroup.releases
      .filter((release) => ids.has(Number(release.releaseId)))
      .reduce((sum, release) => sum + Number(release.amount || 0), 0);
  }, [selectedGroup, selectedReleaseIds]);

  const printReceipt = (receipt) => {
    localStorage.setItem(
      "accredited_seller_proof_payload",
      JSON.stringify({ seller: receiptSeller, receipt })
    );
    window.open("/super_admin/accredited/proof-of-income/print", "_blank");
  };

  const printUploadedDocument = () => {
    localStorage.setItem(
      "accredited_seller_proof_payload",
      JSON.stringify({ seller })
    );
    window.open("/super_admin/accredited/proof-of-income/print", "_blank");
  };

  const createReceiptMutation = useMutation({
    mutationFn: (body) => useFetchPost(`/accredited/${sellerId}/proof-of-income-receipts`, body),
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
    const id = Number(releaseId);
    setSelectedReleaseIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleGenerate = () => {
    if (!selectedGroup) {
      setLocalAlert({ type: "warning", message: "No released commission is available for a new receipt." });
      return;
    }
    if (!selectedReleaseIds.length) {
      setLocalAlert({ type: "error", message: "Select at least one released commission stage." });
      return;
    }

    createReceiptMutation.mutate({
      commissionId: Number(selectedGroup.commissionId),
      releaseIds: selectedReleaseIds,
      ...form,
    });
  };

  const uploadedDocument = seller?.proofOfIncomeDocument || seller?.proof_of_income_document;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Print Proof of Income</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {receiptSeller.full_name || seller.full_name} · Combine released stages from one property into one receipt.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={createReceiptMutation.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" aria-label="Close proof of income modal">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
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
                            <input type="checkbox" checked={selectedReleaseIds.includes(Number(release.releaseId))} onChange={() => toggleRelease(release.releaseId)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
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

                  <button type="button" onClick={handleGenerate} disabled={!selectedGroup || !selectedReleaseIds.length || createReceiptMutation.isPending} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                    {createReceiptMutation.isPending ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPrinter className="h-4 w-4" />}
                    {createReceiptMutation.isPending ? "Generating..." : `Generate & Print ${money(selectedAmount)}`}
                  </button>

                  {uploadedDocument ? (
                    <button type="button" onClick={printUploadedDocument} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50">
                      <FiFileText className="h-4 w-4" /> Print Uploaded Document
                    </button>
                  ) : null}
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
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={createReceiptMutation.isPending} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Close</button>
        </div>
      </div>
    </div>
  );
};

const Accredited = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [alert, setAlert] = useState(null);
  const [uploadSeller, setUploadSeller] = useState(null);
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
    queryFn: () => useFetch(`/accredited?${queryString}`),
    keepPreviousData: true,
  });

  const uploadProofMutation = useMutation({
    mutationFn: ({ sellerId, payload }) => useFetchPost(`/accredited/${sellerId}/proof-of-income`, payload),
    onMutate: () => setAlert({ type: "loading", message: "Uploading proof of income..." }),
    onSuccess: (result) => {
      setAlert({ type: "success", message: result?.message || "Proof of income uploaded." });
      setUploadSeller(null);
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
    },
    onError: (mutationError) => {
      setAlert({ type: "error", message: mutationError?.message || "Failed to upload proof of income." });
    },
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
      <PageHeader title="Accredited Sellers" description="Seller directory, project rates, and proof of income documents." icon={FaUserPlus} />

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
          <div><h2 className="text-lg font-bold text-slate-950">Seller Directory</h2><p className="text-sm text-slate-500">View reporting chain, group assignment, project rates, and proof of income.</p></div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search sellers..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Roles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["accredited"] })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>

        <div className="overflow-x-auto"><div className="min-w-[1650px]">
          <div className="grid grid-cols-[1.35fr_0.95fr_1.1fr_1.1fr_1.95fr_1.1fr_0.9fr_1.2fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><p>Seller</p><p>Role</p><p>Group</p><p>Reports Under</p><p>Project Rates</p><p>Proof of Income</p><p>Status / Updated</p><p>Actions</p></div>
          <div className="divide-y divide-slate-100">
            {isLoading ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading accredited sellers...</div> : sellers.length === 0 ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No accredited sellers found.</div> : sellers.map((seller) => {
              const document = seller.proofOfIncomeDocument || seller.proof_of_income_document;

              return (
                <div key={seller.accredited_seller_id} className="grid grid-cols-[1.35fr_0.95fr_1.1fr_1.1fr_1.95fr_1.1fr_0.9fr_1.2fr] items-center px-4 py-4 text-sm">
                  <div><p className="font-bold text-slate-950">{seller.full_name}</p><p className="text-xs text-slate-500">{seller.email} • {seller.contact_no || "No contact"}</p></div>
                  <p className="font-semibold text-slate-700">{roleLabels[seller.role] || seller.role}</p>
                  <p className="font-semibold text-slate-700">{seller.seller_group_name || "No group"}</p>
                  <p className="text-slate-600">{seller.reports_under_name || "Direct to Developer"}</p>
                  <SellerRatesCell rates={seller.project_rates} />
                  <ProofStatusCell document={document} />
                  <div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${seller.accredited_seller_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{seller.accredited_seller_status}</span><p className="mt-1 text-xs text-slate-500">{seller.accredited_seller_updated_at ? formatDateTime(seller.accredited_seller_updated_at) : "—"}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setUploadSeller(seller)} disabled={uploadProofMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"><FiUploadCloud className="h-4 w-4" />Upload</button>
                    <button type="button" onClick={() => handlePrintProof(seller)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Print Proof of Income</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div></div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm font-semibold text-slate-500">Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} records</p><div className="flex items-center gap-2"><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
      </section>

      {uploadSeller ? (
        <ProofOfIncomeUploadModal
          seller={uploadSeller}
          isSaving={uploadProofMutation.isPending}
          onClose={() => setUploadSeller(null)}
          onSave={(payload) => uploadProofMutation.mutate(payload)}
        />
      ) : null}

      {proofSeller ? (
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



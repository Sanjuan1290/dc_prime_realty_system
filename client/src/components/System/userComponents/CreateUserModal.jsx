import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiChevronDown,
  FiSearch,
  FiUser,
  FiUserCheck,
  FiX,
} from "react-icons/fi";
import StatusAlert from "../../Shared/StatusAlert";
import { useFetch as fetchApi, useFetchPost as postApi } from "../../../utils/useFetch";

const sellerRoles = ["broker_network_manager", "broker", "manager", "agent"];

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const getRoleDefaultRate = (role) => {
  if (role === "broker_network_manager") return 8;
  if (role === "broker") return 7;
  if (role === "manager") return 5;
  if (role === "agent") return 3;
  return 0;
};

const normalizeProjectRates = (
  projects = [],
  existingRates = [],
  defaultRate = 0,
  valueKey = "accredited_seller_project_rate"
) => {
  const rateMap = new Map(
    (existingRates || []).map((rate) => [Number(rate.lot_project_id), rate])
  );

  return projects.map((project) => {
    const current = rateMap.get(Number(project.lot_project_id || project.id));

    return {
      lot_project_id: Number(project.lot_project_id || project.id),
      lot_project_name: project.lot_project_name || project.label,
      lot_project_location_code: project.lot_project_location_code,
      [valueKey]: String(current?.[valueKey] ?? current?.rate ?? defaultRate),
    };
  });
};

const SearchableSelect = ({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyOptionLabel,
  emptyText = "No matching options found.",
  disabled = false,
  required = false,
}) => {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  );

  const filteredOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return options;

    return options.filter((option) =>
      `${option.label || ""} ${option.description || ""}`
        .toLowerCase()
        .includes(keyword)
    );
  }, [options, search]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const selectOption = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <p className="text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </p>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <span className={selectedOption ? "truncate text-slate-900" : "truncate text-slate-400"}>
          {selectedOption?.label || placeholder}
        </span>
        <FiChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[74px] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
              <FiSearch className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div role="listbox" className="max-h-60 overflow-y-auto p-1.5">
            {emptyOptionLabel && !search.trim() ? (
              <button
                type="button"
                onClick={() => selectOption("")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <span>{emptyOptionLabel}</span>
                {!value ? <FiCheck className="h-4 w-4 text-blue-600" /> : null}
              </button>
            ) : null}

            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = String(option.value) === String(value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(String(option.value))}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      isSelected ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <FiCheck className="h-4 w-4 shrink-0 text-blue-600" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-5 text-center text-sm font-semibold text-slate-500">
                {emptyText}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const CreateUserModal = ({ setShowCreateUser, onSaved }) => {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(1);
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    contact_no: "",
    tin_no: "",
    password: "password",
    role: "agent",
    status: "active",
    seller_group_id: "",
    reports_under_user_id: "",
    accreditation_date: new Date().toISOString().slice(0, 10),
  });
  const [projectRateValues, setProjectRateValues] = useState({});

  const { data: groupData, isLoading: isGroupsLoading, isError: isGroupsError, error: groupsError } = useQuery({
    queryKey: ["seller-group-options"],
    queryFn: () => fetchApi("/seller-groups/options"),
  });

  const { data: parentData, isLoading: isParentsLoading, isError: isParentsError, error: parentsError } = useQuery({
    queryKey: ["parent-sellers"],
    queryFn: () => fetchApi("/accredited/parents"),
  });

  const { data: projectData, isLoading: isProjectsLoading, isError: isProjectsError, error: projectsError } = useQuery({
    queryKey: ["lot-project-options"],
    queryFn: () => fetchApi("/projects/lot-projects/options"),
  });

  const sellerGroups = useMemo(() => groupData?.data || [], [groupData?.data]);
  const parentSellers = useMemo(() => parentData?.data || [], [parentData?.data]);
  const lotProjects = useMemo(() => projectData?.data || [], [projectData?.data]);
  const isSellerRole = sellerRoles.includes(form.role);
  const totalSteps = isSellerRole ? 2 : 1;

  const projectRates = useMemo(() => {
    if (!isSellerRole) return [];

    const existingRates = Object.entries(projectRateValues).map(([projectId, rate]) => ({
      lot_project_id: Number(projectId),
      accredited_seller_project_rate: rate,
    }));

    return normalizeProjectRates(
      lotProjects,
      existingRates,
      getRoleDefaultRate(form.role)
    );
  }, [form.role, isSellerRole, lotProjects, projectRateValues]);

  const allowedParents = useMemo(() => {
    if (!isSellerRole || form.role === "broker_network_manager") return [];

    return parentSellers.filter((seller) => {
      if (
        form.seller_group_id &&
        seller.seller_group_id &&
        Number(seller.seller_group_id) !== Number(form.seller_group_id)
      ) {
        return false;
      }

      if (form.role === "broker") return seller.role === "broker_network_manager";
      if (form.role === "manager") {
        return seller.role === "broker" || seller.role === "broker_network_manager";
      }

      return ["manager", "broker", "broker_network_manager"].includes(seller.role);
    });
  }, [form.role, form.seller_group_id, isSellerRole, parentSellers]);

  const groupOptions = useMemo(
    () =>
      sellerGroups.map((group) => ({
        value: String(group.seller_group_id),
        label: group.seller_group_name,
      })),
    [sellerGroups]
  );

  const parentOptions = useMemo(
    () =>
      allowedParents.map((seller) => ({
        value: String(seller.user_id),
        label: seller.full_name,
        description: `${roleLabels[seller.role] || seller.role}${
          seller.seller_group_id ? " · Same seller group" : ""
        }`,
      })),
    [allowedParents]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      postApi("/user/createUser", {
        ...form,
        project_rates: isSellerRole ? projectRates : [],
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
      queryClient.invalidateQueries({ queryKey: ["parent-sellers"] });
      setShowCreateUser(false);
      onSaved?.(data.message || "User created successfully.");
    },
    onError: (error) => setWarning(error.message),
  });

  const updateForm = (field, value) => {
    setWarning("");
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const updateProjectRate = (projectId, value) => {
    setProjectRateValues((current) => ({
      ...current,
      [Number(projectId)]: value,
    }));
  };

  const validateAccountStep = () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setWarning("First name, last name, and email are required.");
      return false;
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setWarning("Enter a valid email address.");
      return false;
    }

    if (!form.password.trim()) {
      setWarning("Temporary password is required.");
      return false;
    }

    return true;
  };

  const validateHierarchyStep = () => {
    if (!isSellerRole) return true;

    if (!form.seller_group_id) {
      setWarning("Select a seller group.");
      return false;
    }

    if (form.role === "agent" && !form.reports_under_user_id) {
      setWarning("Select who this agent reports under.");
      return false;
    }

    const invalidRate = projectRates.find((rate) => {
      const value = Number(rate.accredited_seller_project_rate);
      return !Number.isFinite(value) || value < 0 || value > 15;
    });

    if (invalidRate) {
      setWarning(`${invalidRate.lot_project_name} rate must be between 0% and 15%.`);
      return false;
    }

    return true;
  };

  const goNext = () => {
    setWarning("");
    if (!validateAccountStep()) return;
    setActiveStep(2);
  };

  const handleSubmit = () => {
    setWarning("");

    if (!validateAccountStep()) {
      setActiveStep(1);
      return;
    }

    if (!validateHierarchyStep()) {
      if (isSellerRole) setActiveStep(2);
      return;
    }

    createMutation.mutate();
  };

  const closeModal = () => {
    if (!createMutation.isPending) setShowCreateUser(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Create User</h3>
            <p className="text-sm text-slate-500">
              {activeStep === 1
                ? "Add account and contact information."
                : "Assign the seller group, reporting line, and project rates."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={createMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close create user modal"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className={`grid gap-3 ${totalSteps === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                activeStep === 1
                  ? "border-blue-300 bg-blue-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${activeStep === 1 ? "bg-blue-600" : "bg-emerald-600"}`}>
                {activeStep > 1 ? <FiCheck className="h-4 w-4" /> : <FiUser className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-sm font-black text-slate-950">1. User Information</span>
                <span className="block text-xs font-semibold text-slate-500">Account, role, and contact details</span>
              </span>
            </button>

            {isSellerRole ? (
              <button
                type="button"
                onClick={() => {
                  if (validateAccountStep()) setActiveStep(2);
                }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  activeStep === 2
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${activeStep === 2 ? "bg-blue-600" : "bg-slate-400"}`}>
                  <FiUserCheck className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-black text-slate-950">2. Seller Hierarchy</span>
                  <span className="block text-xs font-semibold text-slate-500">Group, reporting line, and rates</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {createMutation.isPending ? (
              <StatusAlert type="loading" message="Creating user and saving seller rates..." />
            ) : null}
            {isGroupsLoading || isParentsLoading || isProjectsLoading ? (
              <StatusAlert type="loading" message="Loading seller groups, reporting options, and project rates..." />
            ) : null}
            {isGroupsError ? (
              <StatusAlert type="error" message={groupsError?.message || "Failed to load seller groups."} />
            ) : null}
            {isParentsError ? (
              <StatusAlert type="error" message={parentsError?.message || "Failed to load parent sellers."} />
            ) : null}
            {isProjectsError ? (
              <StatusAlert type="error" message={projectsError?.message || "Failed to load lot projects."} />
            ) : null}
            {warning ? <StatusAlert type="warning" message={warning} /> : null}

            {activeStep === 1 ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">First Name *</p>
                    <input type="text" value={form.first_name} onChange={(event) => updateForm("first_name", event.target.value)} placeholder="Enter first name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Middle Name</p>
                    <input type="text" value={form.middle_name} onChange={(event) => updateForm("middle_name", event.target.value)} placeholder="Optional middle name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Last Name *</p>
                    <input type="text" value={form.last_name} onChange={(event) => updateForm("last_name", event.target.value)} placeholder="Enter last name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Email *</p>
                    <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="user@example.com" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Contact No.</p>
                    <input type="text" value={form.contact_no} onChange={(event) => updateForm("contact_no", event.target.value)} placeholder="09XXXXXXXXX" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">TIN No.</p>
                    <input type="text" value={form.tin_no} onChange={(event) => updateForm("tin_no", event.target.value)} placeholder="000-000-000-000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Temporary Password *</p>
                    <input type="text" value={form.password} onChange={(event) => updateForm("password", event.target.value)} placeholder="Default: password" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Role</p>
                    <select
                      value={form.role}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        setForm((current) => ({
                          ...current,
                          role: nextRole,
                          seller_group_id: sellerRoles.includes(nextRole) ? current.seller_group_id : "",
                          reports_under_user_id: "",
                        }));
                        setProjectRateValues({});
                        setActiveStep(1);
                        setWarning("");
                      }}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Status</p>
                    <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </>
            ) : null}

            {activeStep === 2 && isSellerRole ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <FiUserCheck className="h-5 w-5 text-blue-700" />
                  <div>
                    <h4 className="font-bold text-slate-950">Seller Hierarchy</h4>
                    <p className="text-sm text-slate-500">
                      Search the group and reporting list instead of scrolling through every record.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <SearchableSelect
                    label="Seller Group"
                    value={form.seller_group_id}
                    options={groupOptions}
                    onChange={(value) => {
                      setForm((current) => ({
                        ...current,
                        seller_group_id: value,
                        reports_under_user_id: "",
                      }));
                      setWarning("");
                    }}
                    placeholder="Select seller group"
                    searchPlaceholder="Search seller groups..."
                    emptyText="No seller groups match your search."
                    required
                  />

                  <SearchableSelect
                    label="Reports Under"
                    value={form.reports_under_user_id}
                    options={parentOptions}
                    onChange={(value) => updateForm("reports_under_user_id", value)}
                    placeholder={form.role === "broker_network_manager" ? "Not applicable" : "Select parent seller"}
                    searchPlaceholder="Search name or role..."
                    emptyOptionLabel={form.role === "agent" ? undefined : "Direct to Developer / None"}
                    emptyText={
                      form.seller_group_id
                        ? "No eligible parent seller matches your search."
                        : "Select a seller group first."
                    }
                    disabled={!form.seller_group_id || form.role === "broker_network_manager"}
                    required={form.role === "agent"}
                  />

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Accreditation Date *</p>
                    <input type="date" value={form.accreditation_date} onChange={(event) => updateForm("accreditation_date", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                </div>

                <div className="mt-5 border-t border-blue-100 pt-5">
                  <div className="mb-3">
                    <h5 className="text-sm font-black text-slate-900">Project Commission Rates</h5>
                    <p className="text-xs font-semibold text-slate-500">Set the seller rate for each active lot project.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {projectRates.map((rate) => (
                      <label key={rate.lot_project_id} className="flex flex-col gap-2">
                        <p className="text-sm font-bold text-slate-700">{rate.lot_project_name} Rate</p>
                        <div className="relative">
                          <input type="number" min="0" max="15" step="0.01" value={rate.accredited_seller_project_rate} onChange={(event) => updateProjectRate(rate.lot_project_id, event.target.value)} placeholder="Example: 3" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500">Step {activeStep} of {totalSteps}</p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={closeModal} disabled={createMutation.isPending} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
              Cancel
            </button>

            {activeStep === 2 ? (
              <button type="button" onClick={() => { setWarning(""); setActiveStep(1); }} disabled={createMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                <FiArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}

            {activeStep === 1 && isSellerRole ? (
              <button type="button" onClick={goNext} disabled={createMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                Next: Seller Hierarchy
                <FiArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled={createMutation.isPending} onClick={handleSubmit} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                {createMutation.isPending ? "Creating..." : "Create User"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;

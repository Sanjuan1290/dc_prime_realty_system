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
import { ADMIN_TYPES } from "../../../config/permissions";
import { useFetch as fetchApi, useFetchPut as putApi } from "../../../utils/useFetch";

const sellerRoles = ["broker_network_manager", "broker", "manager", "agent"];

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const getRequiredParentRole = (role) => ({
  broker: "broker_network_manager",
  manager: "broker",
  agent: "manager",
}[role] || "");

const toDateInput = (value) => {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || new Date().toISOString().slice(0, 10);
};

const getInitialForm = (user = {}, { initialSellerGroupId = "", lockSellerGroup = false } = {}) => ({
  first_name: String(user.first_name ?? user.firstName ?? ""),
  middle_name: String(user.middle_name ?? user.middleName ?? ""),
  last_name: String(user.last_name ?? user.lastName ?? ""),
  email: String(user.email ?? ""),
  contact_no: String(user.contact_no ?? user.contactNo ?? ""),
  tin_no: String(user.tin_no ?? user.tinNo ?? ""),
  prc_no: String(user.prc_no ?? user.prcNo ?? ""),
  address: String(user.address ?? ""),
  role: String(user.role || "agent"),
  admin_type: String(user.admin_type || (user.role === "admin" ? "admin_1" : "")),
  status: String(user.status || user.user_status || user.accredited_seller_status || "active"),
  seller_group_id: String(
    lockSellerGroup
      ? (initialSellerGroupId || user.seller_group_id || "")
      : (user.seller_group_id || "")
  ),
  reports_under_user_id: String(
    user.reports_under_user_id
      ?? user.accredited_seller_reports_under_user_id
      ?? ""
  ),
  accreditation_date: toDateInput(
    user.accreditation_date
      ?? user.accredited_seller_accreditation_date
  ),
});

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
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
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
                      isSelected
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-700 hover:bg-slate-50"
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
                    {isSelected ? (
                      <FiCheck className="h-4 w-4 shrink-0 text-blue-600" />
                    ) : null}
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

const EditUserModal = ({
  setShowEditUser,
  selectedUser,
  onSaved,
  allowedRoles = Object.keys(roleLabels),
  actorRole = "super_admin",
  initialSellerGroupId = "",
  lockSellerGroup = false,
}) => {
  const queryClient = useQueryClient();
  const availableRoleEntries = useMemo(() => Object.entries(roleLabels).filter(([value]) => allowedRoles.includes(value)), [allowedRoles]);
  const isPrivilegedRoleLocked = false;
  const [activeStep, setActiveStep] = useState(1);
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState(() => getInitialForm(selectedUser, {
    initialSellerGroupId,
    lockSellerGroup,
  }));

  const {
    data: groupData,
    isLoading: isGroupsLoading,
    isError: isGroupsError,
    error: groupsError,
  } = useQuery({
    queryKey: ["seller-group-options"],
    queryFn: () => fetchApi("/seller-groups/options"),
  });

  const {
    data: parentData,
    isLoading: isParentsLoading,
    isError: isParentsError,
    error: parentsError,
  } = useQuery({
    queryKey: ["parent-sellers"],
    queryFn: () => fetchApi("/accredited/parents"),
  });



  const sellerGroups = useMemo(() => groupData?.data || [], [groupData?.data]);
  const parentSellers = useMemo(() => parentData?.data || [], [parentData?.data]);
  const isSellerRole = sellerRoles.includes(form.role);
  const totalSteps = isSellerRole ? 2 : 1;
  const selectedGroup = useMemo(
    () => sellerGroups.find((group) => Number(group.seller_group_id) === Number(form.seller_group_id)) || null,
    [sellerGroups, form.seller_group_id]
  );


  const allowedParents = useMemo(() => {
    if (!isSellerRole || form.role === "broker_network_manager") return [];

    return parentSellers.filter((seller) => {
      if (Number(seller.user_id) === Number(selectedUser?.id)) return false;

      if (!form.seller_group_id || Number(seller.seller_group_id) !== Number(form.seller_group_id)) {
        return false;
      }

      return seller.role === getRequiredParentRole(form.role);
    });
  }, [form.role, form.seller_group_id, isSellerRole, parentSellers, selectedUser?.id]);

  const isSelectedUserGroupHead = Number(selectedGroup?.seller_group_head_user_id || 0) === Number(selectedUser?.id || 0);
  const groupHasHead = Boolean(selectedGroup?.seller_group_head_user_id);
  const groupHeadRole = selectedGroup?.seller_group_head_role || '';
  const canReplaceBrokerHead = form.role === "broker_network_manager"
    && groupHeadRole === "broker"
    && !isSelectedUserGroupHead;
  const roleConflictsWithGroupHead = form.role === "broker_network_manager"
    && groupHasHead
    && !isSelectedUserGroupHead
    && !canReplaceBrokerHead;
  const canLeaveParentEmpty = (form.role === "broker_network_manager" && (!groupHasHead || isSelectedUserGroupHead || canReplaceBrokerHead))
    || (form.role === "broker" && (isSelectedUserGroupHead || !groupHasHead));
  const parentIsRequired = isSellerRole && !canLeaveParentEmpty;

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

  const updateMutation = useMutation({
    mutationFn: () =>
      putApi(`/user/editUser/${selectedUser.id}`, form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
      queryClient.invalidateQueries({ queryKey: ["parent-sellers"] });
      setShowEditUser(false);
      onSaved?.(data.message || "User updated successfully.");
    },
    onError: (error) => setWarning(error.message),
  });

  const updateForm = (field, value) => {
    setWarning("");
    setForm((current) => ({ ...current, [field]: value }));
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

    if (!allowedRoles.includes(form.role)) {
      setWarning("You do not have permission to assign this user role.");
      return false;
    }

    if (form.role === "admin" && form.admin_type !== "admin_1") {
      setWarning("Only Admin 1 is available right now. Admin 2 and Admin 3 will be configured later.");
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

    if (roleConflictsWithGroupHead) {
      setWarning("This group already has a Broker Network Manager as its head.");
      return false;
    }

    if (parentIsRequired && !form.reports_under_user_id) {
      setWarning(`${roleLabels[form.role]} must report under a ${roleLabels[getRequiredParentRole(form.role)]}.`);
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

    updateMutation.mutate();
  };

  const closeModal = () => {
    if (!updateMutation.isPending) setShowEditUser(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Edit User</h3>
            <p className="text-sm text-slate-500">
              {activeStep === 1
                ? "Update account and contact information."
                : "Update the seller group and reporting line. Commission rates are inherited from the Realty."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={updateMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close edit user modal"
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
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                  activeStep === 1 ? "bg-blue-600" : "bg-emerald-600"
                }`}
              >
                {activeStep > 1 ? <FiCheck className="h-4 w-4" /> : <FiUser className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-sm font-black text-slate-950">1. User Information</span>
                <span className="block text-xs font-semibold text-slate-500">Account, role, TIN, and contact details</span>
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
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                    activeStep === 2 ? "bg-blue-600" : "bg-slate-400"
                  }`}
                >
                  <FiUserCheck className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-black text-slate-950">2. Seller Hierarchy</span>
                  <span className="block text-xs font-semibold text-slate-500">Group and reporting line</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {updateMutation.isPending ? (
              <StatusAlert type="loading" message="Saving user changes..." />
            ) : null}
            {isGroupsLoading || isParentsLoading ? (
              <StatusAlert type="loading" message="Loading seller groups and reporting options..." />
            ) : null}
            {isGroupsError ? (
              <StatusAlert type="error" message={groupsError?.message || "Failed to load seller groups."} />
            ) : null}
            {isParentsError ? (
              <StatusAlert type="error" message={parentsError?.message || "Failed to load parent sellers."} />
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
                    <p className="text-sm font-bold text-slate-700">PRC No. <span className="font-medium text-slate-400">(optional)</span></p>
                    <input type="text" value={form.prc_no} onChange={(event) => updateForm("prc_no", event.target.value)} placeholder="PRC registration number" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Address</p>
                  <input type="text" value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Complete seller address" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Role</p>
                    <select
                      value={form.role}
                      disabled={isPrivilegedRoleLocked}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        setForm((current) => ({
                          ...current,
                          role: nextRole,
                          admin_type: nextRole === "admin" ? "admin_1" : "",
                          seller_group_id: sellerRoles.includes(nextRole)
                            ? (lockSellerGroup
                              ? String(initialSellerGroupId || current.seller_group_id)
                              : current.seller_group_id)
                            : "",
                          reports_under_user_id: "",
                        }));
                        setActiveStep(1);
                        setWarning("");
                      }}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {availableRoleEntries.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <p className="text-xs font-semibold text-slate-500">Admin 1 has full user-management access. Admin 2 and Admin 3 remain unavailable.</p>
                  </label>

                  {form.role === "admin" ? (
                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">Admin Type</p>
                      <select value={form.admin_type || "admin_1"} onChange={(event) => updateForm("admin_type", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        {ADMIN_TYPES.map((type) => <option key={type.value} value={type.value} disabled={type.disabled}>{type.label}{type.disabled ? " — Coming later" : " — Full access"}</option>)}
                      </select>
                      <p className="text-xs font-semibold text-slate-500">Admin 1 has the same permissions as Super Admin.</p>
                    </label>
                  ) : null}

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Status</p>
                    <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <p className="font-bold text-slate-700">Password</p>
                    <p className="mt-1 text-xs font-semibold">Use Reset Password from the users table when needed.</p>
                  </div>
                </div>
              </>
            ) : null}

            {activeStep === 2 && isSellerRole ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <FiUserCheck className="h-5 w-5 text-blue-700" />
                  <div>
                    <h4 className="font-bold text-slate-950">Seller Hierarchy</h4>
                    <p className="text-sm text-slate-500">Search the group and reporting list instead of scrolling through every record.</p>
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
                    disabled={lockSellerGroup}
                  />

                  <SearchableSelect
                    label="Reports Under"
                    value={form.reports_under_user_id}
                    options={parentOptions}
                    onChange={(value) => updateForm("reports_under_user_id", value)}
                    placeholder={form.role === "broker_network_manager" ? "Direct to Developer" : `Select ${roleLabels[getRequiredParentRole(form.role)] || "parent seller"}`}
                    searchPlaceholder="Search name or role..."
                    emptyOptionLabel={canLeaveParentEmpty && form.role !== "broker_network_manager" ? "Direct to Developer / None" : undefined}
                    emptyText={
                      form.seller_group_id
                        ? "No eligible parent seller matches your search."
                        : "Select a seller group first."
                    }
                    disabled={!form.seller_group_id || form.role === "broker_network_manager"}
                    required={parentIsRequired}
                  />

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Accreditation Date *</p>
                    <input type="date" value={form.accreditation_date} onChange={(event) => updateForm("accreditation_date", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  </label>
                </div>

                <div className="mt-5 rounded-xl border border-blue-200 bg-white px-4 py-3">
                  <h5 className="text-sm font-black text-slate-900">Inherited Commission Rates</h5>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    This seller automatically uses the fixed BNM, Broker, Manager, or Agent rate configured for the selected Realty and project. Individual seller rates cannot be edited.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500">Step {activeStep} of {totalSteps}</p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={closeModal} disabled={updateMutation.isPending} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
              Cancel
            </button>

            {activeStep === 2 ? (
              <button type="button" onClick={() => { setWarning(""); setActiveStep(1); }} disabled={updateMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                <FiArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}

            {activeStep === 1 && isSellerRole ? (
              <button type="button" onClick={goNext} disabled={updateMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                Next: Seller Hierarchy
                <FiArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled={updateMutation.isPending} onClick={handleSubmit} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                {updateMutation.isPending ? "Saving..." : "Save User Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;

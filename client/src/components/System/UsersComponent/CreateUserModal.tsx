import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { FiKey, FiMail, FiShield, FiUserCheck, FiUsers, FiX } from "react-icons/fi";

type UserRole =
  | "super_admin"
  | "admin"
  | "broker_network_manager"
  | "broker"
  | "manager"
  | "agent";

type UserStatus = "active" | "inactive";

type SellerGroupOption = {
  seller_group_id: number;
  seller_group_name: string;
};

type ParentSellerOption = {
  user_id: number;
  full_name: string;
  role: UserRole;
  seller_group_id: number | null;
};

type Props = {
  setShowCreateUser: Dispatch<SetStateAction<boolean>>;
  onSaved: (message: string) => void;
};

const API_URL = import.meta.env.VITE_API_URL || "";

const sellerRoles: UserRole[] = [
  "broker_network_manager",
  "broker",
  "manager",
  "agent",
];

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong.";
};

const CreateUserModal = ({ setShowCreateUser, onSaved }: Props) => {
  const [isSaving, setIsSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [sellerGroups, setSellerGroups] = useState<SellerGroupOption[]>([]);
  const [parentSellers, setParentSellers] = useState<ParentSellerOption[]>([]);

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    contact_no: "",
    password: "password",
    role: "agent" as UserRole,
    status: "active" as UserStatus,
    seller_group_id: "",
    reports_under_user_id: "",
    accreditation_date: new Date().toISOString().slice(0, 10),
  });

  const isSellerRole = sellerRoles.includes(form.role);

  const allowedParents = useMemo(() => {
    if (!isSellerRole) return [];

    return parentSellers.filter((seller) => {
      if (form.role === "broker_network_manager") return false;
      if (form.role === "broker") return seller.role === "broker_network_manager";
      if (form.role === "manager") return seller.role === "broker" || seller.role === "broker_network_manager";
      return seller.role === "manager" || seller.role === "broker" || seller.role === "broker_network_manager";
    });
  }, [form.role, isSellerRole, parentSellers]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [groupsRes, parentsRes] = await Promise.all([
          fetch(`${API_URL}/seller-groups/options`, { credentials: "include" }),
          fetch(`${API_URL}/accredited/parents`, { credentials: "include" }),
        ]);

        const groupsData = await groupsRes.json();
        const parentsData = await parentsRes.json();

        if (groupsRes.ok) setSellerGroups(groupsData.data || []);
        if (parentsRes.ok) setParentSellers(parentsData.data || []);
      } catch {
        setWarning("Options failed to load. You can still fill up account details.");
      }
    };

    loadOptions();
  }, []);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setWarning("");

    try {
      const body = {
        ...form,
        middle_name: form.middle_name.trim() || null,
        seller_group_id: isSellerRole && form.seller_group_id ? Number(form.seller_group_id) : null,
        reports_under_user_id: isSellerRole && form.reports_under_user_id ? Number(form.reports_under_user_id) : null,
        accreditation_date: isSellerRole ? form.accreditation_date : null,
      };

      const res = await fetch(`${API_URL}/user/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create user.");

      setShowCreateUser(false);
      onSaved(data.message || "User created successfully.");
    } catch (error) {
      setWarning(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Create User</h3>
            <p className="text-sm text-slate-500">
              Add account details, access role, and seller hierarchy.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateUser(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-6">
            {warning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                {warning}
              </div>
            )}

            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FiUsers className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-950">Personal Information</h4>
                  <p className="text-sm text-slate-500">Basic user profile details.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">First Name</p>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(event) => updateForm("first_name", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Middle Name</p>
                  <input
                    type="text"
                    value={form.middle_name}
                    onChange={(event) => updateForm("middle_name", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Last Name</p>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(event) => updateForm("last_name", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Email</p>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Contact No.</p>
                  <input
                    type="text"
                    value={form.contact_no}
                    onChange={(event) => updateForm("contact_no", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                  <FiShield className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-950">Account Access</h4>
                  <p className="text-sm text-slate-500">Set login role and account status.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Role</p>
                  <select
                    value={form.role}
                    onChange={(event) => {
                      updateForm("role", event.target.value as UserRole);
                      updateForm("reports_under_user_id", "");
                    }}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Status</p>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value as UserStatus)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Temporary Password</p>
                  <input
                    type="text"
                    value={form.password}
                    onChange={(event) => updateForm("password", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <FiKey className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">First login password change</p>
                    <p className="mt-1 text-sm text-amber-700">
                      New users are marked as password-change required.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {isSellerRole && (
              <section>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <FiUserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-950">Seller Hierarchy</h4>
                    <p className="text-sm text-slate-500">
                      Rates are still managed inside Seller Groups.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Seller Group</p>
                    <select
                      value={form.seller_group_id}
                      onChange={(event) => updateForm("seller_group_id", event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      <option value="">Select seller group</option>
                      {sellerGroups.map((group) => (
                        <option key={group.seller_group_id} value={group.seller_group_id}>
                          {group.seller_group_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Reports Under</p>
                    <select
                      value={form.reports_under_user_id}
                      onChange={(event) => updateForm("reports_under_user_id", event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      <option value="">Direct to Developer / None</option>
                      {allowedParents.map((seller) => (
                        <option key={seller.user_id} value={seller.user_id}>
                          {seller.full_name} - {roleLabels[seller.role]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Accreditation Date</p>
                    <input
                      type="date"
                      value={form.accreditation_date}
                      onChange={(event) => updateForm("accreditation_date", event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex gap-3">
                <FiMail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <p className="text-sm font-bold text-blue-800">Account email notice</p>
                  <p className="mt-1 text-sm text-blue-700">
                    Backend can later send this temporary password by email.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setShowCreateUser(false)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;

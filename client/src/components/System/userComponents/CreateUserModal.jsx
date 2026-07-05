import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiUserCheck, FiX } from "react-icons/fi";
import StatusAlert from "../../Shared/StatusAlert";
import { useFetch, useFetchPost } from "../../../utils/useFetch";

const sellerRoles = ["broker_network_manager", "broker", "manager", "agent"];

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const rateOptions = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const getRoleDefaultRate = (role) => {
  if (role === "broker_network_manager") return 8;
  if (role === "broker") return 7;
  if (role === "manager") return 5;
  if (role === "agent") return 3;
  return 0;
};

const normalizeProjectRates = (projects = [], existingRates = [], defaultRate = 0, valueKey = "accredited_seller_project_rate") => {
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


const CreateUserModal = ({ setShowCreateUser, onSaved }) => {
  const queryClient = useQueryClient();
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    contact_no: "",
    password: "password",
    role: "agent",
    status: "active",
    seller_group_id: "",
    reports_under_user_id: "",
    accreditation_date: new Date().toISOString().slice(0, 10),
  });
  const [projectRates, setProjectRates] = useState([]);

  const { data: groupData, isLoading: isGroupsLoading, isError: isGroupsError, error: groupsError } = useQuery({
    queryKey: ["seller-group-options"],
    queryFn: () => useFetch("/seller-groups/options"),
  });

  const { data: parentData, isLoading: isParentsLoading, isError: isParentsError, error: parentsError } = useQuery({
    queryKey: ["parent-sellers"],
    queryFn: () => useFetch("/accredited/parents"),
  });

  const { data: projectData, isLoading: isProjectsLoading, isError: isProjectsError, error: projectsError } = useQuery({
    queryKey: ["lot-project-options"],
    queryFn: () => useFetch("/projects/lot-projects/options"),
  });

  const sellerGroups = groupData?.data || [];
  const parentSellers = parentData?.data || [];
  const lotProjects = projectData?.data || [];
  const isSellerRole = sellerRoles.includes(form.role);

  useEffect(() => {
    if (!lotProjects.length || !isSellerRole) {
      setProjectRates([]);
      return;
    }

    setProjectRates(normalizeProjectRates(lotProjects, projectRates, getRoleDefaultRate(form.role)));
  }, [lotProjects.length, form.role, isSellerRole]);

  const allowedParents = useMemo(() => {
    if (!isSellerRole) return [];

    return parentSellers.filter((seller) => {
      if (form.seller_group_id && seller.seller_group_id && Number(seller.seller_group_id) !== Number(form.seller_group_id)) return false;
      if (form.role === "broker_network_manager") return false;
      if (form.role === "broker") return seller.role === "broker_network_manager";
      if (form.role === "manager") return seller.role === "broker" || seller.role === "broker_network_manager";
      return seller.role === "manager" || seller.role === "broker" || seller.role === "broker_network_manager";
    });
  }, [form.role, form.seller_group_id, isSellerRole, parentSellers]);

  const createMutation = useMutation({
    mutationFn: () => useFetchPost("/user/createUser", {
      ...form,
      project_rates: isSellerRole ? projectRates : [],
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
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
    setProjectRates((current) =>
      current.map((rate) =>
        Number(rate.lot_project_id) === Number(projectId)
          ? { ...rate, accredited_seller_project_rate: value }
          : rate
      )
    );
  };

  const handleSubmit = () => {
    setWarning("");
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setWarning("First name, last name, and email are required.");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Create User</h3>
            <p className="text-sm text-slate-500">Add account details and set seller hierarchy.</p>
          </div>

          <button type="button" onClick={() => setShowCreateUser(false)} disabled={createMutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {createMutation.isPending ? <StatusAlert type="loading" message="Creating user and saving seller rates..." /> : null}
            {isGroupsLoading || isParentsLoading || isProjectsLoading ? <StatusAlert type="loading" message="Loading groups, parent sellers, and project rates..." /> : null}
            {isGroupsError ? <StatusAlert type="error" message={groupsError?.message || "Failed to load seller groups."} /> : null}
            {isParentsError ? <StatusAlert type="error" message={parentsError?.message || "Failed to load parent sellers."} /> : null}
            {isProjectsError ? <StatusAlert type="error" message={projectsError?.message || "Failed to load lot projects."} /> : null}
            {warning ? <StatusAlert type="warning" message={warning} /> : null}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">First Name</p><input type="text" value={form.first_name} onChange={(event) => updateForm("first_name", event.target.value)} placeholder="Enter first name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Middle Name</p><input type="text" value={form.middle_name} onChange={(event) => updateForm("middle_name", event.target.value)} placeholder="Optional middle name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Last Name</p><input type="text" value={form.last_name} onChange={(event) => updateForm("last_name", event.target.value)} placeholder="Enter last name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Email</p><input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="user@example.com" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Contact No.</p><input type="text" value={form.contact_no} onChange={(event) => updateForm("contact_no", event.target.value)} placeholder="09XXXXXXXXX" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Temporary Password</p><input type="text" value={form.password} onChange={(event) => updateForm("password", event.target.value)} placeholder="Default: password" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">Role</p>
                <select value={form.role} onChange={(event) => { updateForm("role", event.target.value); updateForm("reports_under_user_id", ""); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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

            {isSellerRole && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-4 flex items-center gap-3"><FiUserCheck className="h-5 w-5 text-blue-700" /><div><h4 className="font-bold text-slate-950">Seller Hierarchy</h4><p className="text-sm text-slate-500">Changing this affects seller directory assignment and project commission rates.</p></div></div>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Seller Group</p><select value={form.seller_group_id} onChange={(event) => { updateForm("seller_group_id", event.target.value); updateForm("reports_under_user_id", ""); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="">Select seller group</option>{sellerGroups.map((group) => <option key={group.seller_group_id} value={group.seller_group_id}>{group.seller_group_name}</option>)}</select></label>
                  <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Reports Under</p><select value={form.reports_under_user_id} onChange={(event) => updateForm("reports_under_user_id", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="">Direct to Developer / None</option>{allowedParents.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} - {roleLabels[seller.role]}</option>)}</select></label>
                  <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Accreditation Date</p><input type="date" value={form.accreditation_date} onChange={(event) => updateForm("accreditation_date", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {projectRates.map((rate) => (
                    <label key={rate.lot_project_id} className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">{rate.lot_project_name} Rate</p>
                      <input type="number" min="0" max="15" step="0.01" value={rate.accredited_seller_project_rate} onChange={(event) => updateProjectRate(rate.lot_project_id, event.target.value)} placeholder="Example: 3" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowCreateUser(false)} disabled={createMutation.isPending} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="button" disabled={createMutation.isPending} onClick={handleSubmit} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{createMutation.isPending ? "Creating..." : "Create User"}</button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;

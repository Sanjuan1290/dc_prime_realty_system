import { useState } from "react";
import { FiX } from "react-icons/fi";

const rateOptions = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const parentSellers = [
  { user_id: 1, full_name: "MARIA REYES DELA CRUZ", role: "broker_network_manager" },
  { user_id: 2, full_name: "JUAN LAZARO SANTOS", role: "broker" },
  { user_id: 3, full_name: "LEA GARCIA RAMOS", role: "manager" },
];

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState({
    seller_group_name: selectedGroup.seller_group_name,
    seller_group_head_user_id: selectedGroup.seller_group_head_user_id ? String(selectedGroup.seller_group_head_user_id) : "",
    seller_group_description: selectedGroup.seller_group_description || "",
    seller_group_pool_rate_bailen: String(selectedGroup.seller_group_pool_rate_bailen),
    seller_group_pool_rate_maragondon: String(selectedGroup.seller_group_pool_rate_maragondon),
    seller_group_pool_rate_general_trias: String(selectedGroup.seller_group_pool_rate_general_trias),
    seller_group_status: selectedGroup.seller_group_status,
  });

  const updateForm = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.seller_group_name.trim()) {
      setWarning("Group name is required.");
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowEditGroupModal(false);
      onSaved?.("Seller group updated successfully.");
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Edit Seller Group</h3>
            <p className="text-sm text-slate-500">Update group details, pool rates, and status.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowEditGroupModal(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {warning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                {warning}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">Group Name</p>
                <input
                  type="text"
                  value={form.seller_group_name}
                  onChange={(event) => updateForm("seller_group_name", event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>

              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">Group Head</p>
                <select
                  value={form.seller_group_head_user_id}
                  onChange={(event) => updateForm("seller_group_head_user_id", event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">No head assigned</option>
                  {parentSellers.map((seller) => (
                    <option key={seller.user_id} value={seller.user_id}>
                      {seller.full_name} - {seller.role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <p className="text-sm font-bold text-slate-700">Description</p>
              <textarea
                rows={4}
                value={form.seller_group_description}
                onChange={(event) => updateForm("seller_group_description", event.target.value)}
                className="resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">Bailen Rate</p>
                <select
                  value={form.seller_group_pool_rate_bailen}
                  onChange={(event) => updateForm("seller_group_pool_rate_bailen", event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  {rateOptions.map((rate) => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">Maragondon Rate</p>
                <select
                  value={form.seller_group_pool_rate_maragondon}
                  onChange={(event) => updateForm("seller_group_pool_rate_maragondon", event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  {rateOptions.map((rate) => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">General Trias Rate</p>
                <select
                  value={form.seller_group_pool_rate_general_trias}
                  onChange={(event) => updateForm("seller_group_pool_rate_general_trias", event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  {rateOptions.map((rate) => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <p className="text-sm font-bold text-slate-700">Status</p>
                <select
                  value={form.seller_group_status}
                  onChange={(event) => updateForm("seller_group_status", event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setShowEditGroupModal(false)}
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
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditGroupModal;

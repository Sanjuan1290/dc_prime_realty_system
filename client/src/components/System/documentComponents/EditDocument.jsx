import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RxCross2 } from "react-icons/rx";
import StatusAlert from "../../Shared/StatusAlert";
import { useFetchPut, getDoubleCheckNotice } from "../../../utils/useFetch";

const EditDocument = ({ document, onClose, onSaved }) => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewNotice, setReviewNotice] = useState(null);
  const [formData, setFormData] = useState({
    document_name: document?.document_name || "",
    document_code: document?.document_code || "",
    document_description: document?.document_description || "",
    document_status: document?.document_status || "active",
    document_is_required: document?.document_is_required ? "required" : "optional",
  });

  const mutation = useMutation({
    mutationFn: () =>
      useFetchPut(`/documents/editDocument/${document.document_id}`, {
        ...formData,
        document_is_required: formData.document_is_required === "required",
      }, {
        doubleCheck: {
          type: 'document',
          mode: 'edit',
          data: {
            document_name: formData.document_name,
            document_code: formData.document_code,
            document_description: formData.document_description,
            document_status: formData.document_status,
            document_is_required: formData.document_is_required === 'required',
          },
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onClose();
      onSaved?.(data?.message || "Document saved successfully.");
    },
    onError: (error) => {
      const notice = getDoubleCheckNotice(error, 'Failed to save document.');
      if (notice.type === 'info') { setErrorMessage(''); setReviewNotice(notice); return; }
      setReviewNotice(null);
      setErrorMessage(notice.message);
    },
  });

  const handleChange = (field, value) => {
    setErrorMessage("");
    setReviewNotice(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage("");
    setReviewNotice(null);

    if (!formData.document_name.trim()) {
      setErrorMessage("Document name is required.");
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Edit Document</h3>
            <p className="mt-1 text-sm text-slate-500">Update the document display details and checklist settings.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]">
            <RxCross2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          {mutation.isPending ? <StatusAlert type="loading" message="Preparing document review..." /> : null}
          {reviewNotice ? <StatusAlert type={reviewNotice.type} message={reviewNotice.message} /> : null}
          {errorMessage ? <StatusAlert type="error" message={errorMessage} /> : null}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">Document Name</span>
            <input type="text" data-example="Valid Government ID" value={formData.document_name} onChange={(event) => handleChange("document_name", event.target.value)} placeholder="Example: Valid Government ID" className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">Document Code</span>
            <input type="text" value={formData.document_code} readOnly aria-readonly="true" className="h-11 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-bold uppercase tracking-wide text-slate-600 shadow-sm outline-none" />
            <span className="text-xs font-medium text-slate-500">Permanent storage code. It cannot be changed after the document is created.</span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <textarea rows={4} data-example="Short clear description" value={formData.document_description} onChange={(event) => handleChange("document_description", event.target.value)} placeholder="Example: Government-issued valid ID, two copies" className="resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Status</span>
              <select value={formData.document_status} onChange={(event) => handleChange("document_status", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Requirement</span>
              <select value={formData.document_is_required} onChange={(event) => handleChange("document_is_required", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300">{mutation.isPending ? "Opening Review..." : "Proceed to Final Review"}</button>
        </div>
      </form>
    </div>
  );
};

export default EditDocument;

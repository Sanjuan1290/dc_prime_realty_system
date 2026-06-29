import { useState } from "react";
import type { FormEvent } from "react";
import { RxCross2 } from "react-icons/rx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Document } from "../../../types/document";

type Props = {
    document: Document;
    onClose: () => void;
};

type EditDocumentForm = {
    document_name: string;
    document_description: string;
    document_is_reusable: "yes" | "no";
    document_status: "active" | "inactive";
    document_is_required: "required" | "optional";
};

const EditDocument = ({ document, onClose }: Props) => {
    const queryClient = useQueryClient();

    const [errorMessage, setErrorMessage] = useState("");

    const [formData, setFormData] = useState<EditDocumentForm>({
        document_name: document.document_name || "",
        document_description: document.document_description || "",
        document_is_reusable: Boolean(document.document_is_reusable)
            ? "yes"
            : "no",
        document_status: document.document_status || "active",
        document_is_required: Boolean(document.document_is_required)
            ? "required"
            : "optional",
    });

    const editDocumentMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(
                `http://localhost:5001/api/v1/document/editDocument/${document.document_id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        document_name: formData.document_name.trim(),
                        document_description: formData.document_description.trim(),
                        document_is_reusable:
                            formData.document_is_reusable === "yes",
                        document_status: formData.document_status,
                        document_is_required:
                            formData.document_is_required === "required",
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to update document");
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            onClose();
        },
        onError: (error) => {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to update document"
            );
        },
    });

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMessage("");

        if (!formData.document_name.trim()) {
            setErrorMessage("Document name is required");
            return;
        }

        editDocumentMutation.mutate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <h3 className="text-xl font-bold text-gray-950">
                        Edit Document
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
                    >
                        <RxCross2 className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex flex-col gap-5 px-6 py-5">
                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-gray-700">
                            Document Name
                        </p>

                        <input
                            type="text"
                            value={formData.document_name}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    document_name: e.target.value,
                                }))
                            }
                            className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-gray-700">
                            Description
                        </p>

                        <textarea
                            rows={4}
                            value={formData.document_description}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    document_description: e.target.value,
                                }))
                            }
                            placeholder="Example: Government-issued valid ID, two copies"
                            className="resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Reusable Across Units
                            </p>

                            <select
                                value={formData.document_is_reusable}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        document_is_reusable: e.target.value as
                                            | "yes"
                                            | "no",
                                    }))
                                }
                                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Status
                            </p>

                            <select
                                value={formData.document_status}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        document_status: e.target.value as
                                            | "active"
                                            | "inactive",
                                    }))
                                }
                                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Requirement
                            </p>

                            <select
                                value={formData.document_is_required}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        document_is_required: e.target.value as
                                            | "required"
                                            | "optional",
                                    }))
                                }
                                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="required">Required</option>
                                <option value="optional">Optional</option>
                            </select>
                        </label>
                    </div>

                    {errorMessage && (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {errorMessage}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={editDocumentMutation.isPending}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {editDocumentMutation.isPending
                            ? "Saving..."
                            : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditDocument;
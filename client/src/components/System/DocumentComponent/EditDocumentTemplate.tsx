import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FiSearch } from "react-icons/fi";
import { RxCross2 } from "react-icons/rx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    Document,
    Template,
    DocumentTemplateList,
} from "../../../types/document";

type Props = {
    template: Template;
    onClose: () => void;
};

type TemplatesResponse = {
    success: boolean;
    templates: Template[];
    template_documents: DocumentTemplateList[];
};

type TemplateForm = {
    template_name: string;
    template_description: string;
    template_status: "active" | "inactive";
};

const EditDocumentTemplate = ({ template, onClose }: Props) => {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const [formData, setFormData] = useState<TemplateForm>({
        template_name: template.template_name || "",
        template_description: template.template_description || "",
        template_status: template.template_status || "active",
    });

    const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);

    const { data: documents = [], isLoading: isDocumentsLoading } =
        useQuery<Document[]>({
            queryKey: ["documents"],
            queryFn: async () => {
                const res = await fetch(
                    "http://localhost:5001/api/v1/document/getDocuments"
                );

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(
                        data.message || "Document retrieve failed!"
                    );
                }

                return data.documents || [];
            },
        });

    const { data: templateData, isLoading: isTemplateLoading } =
        useQuery<TemplatesResponse>({
            queryKey: ["templates"],
            queryFn: async () => {
                const res = await fetch(
                    "http://localhost:5001/api/v1/document/getTemplates"
                );

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(
                        data.message || "Template retrieve failed!"
                    );
                }

                return data;
            },
        });

    const currentTemplateDocumentIds = useMemo(() => {
        const rows = templateData?.template_documents || [];

        return rows
            .filter((item) => item.template_id === template.template_id)
            .map((item) => item.document_id);
    }, [templateData, template.template_id]);

    useEffect(() => {
        if (documents.length === 0) return;

        const idSet = new Set(currentTemplateDocumentIds);

        const currentDocuments = documents.filter((document) =>
            idSet.has(document.document_id)
        );

        setSelectedDocuments(currentDocuments);
    }, [documents, currentTemplateDocumentIds]);

    const editTemplateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(
                `http://localhost:5001/api/v1/document/editTemplate/${template.template_id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        template_name: formData.template_name.trim(),
                        template_description:
                            formData.template_description.trim(),
                        template_status: formData.template_status,
                        document_ids: selectedDocuments.map(
                            (document) => document.document_id
                        ),
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to update template");
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            onClose();
        },
        onError: (error) => {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to update template"
            );
        },
    });

    const selectedDocumentIds = useMemo(
        () => new Set(selectedDocuments.map((document) => document.document_id)),
        [selectedDocuments]
    );

    const availableDocuments = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return documents.filter((document) => {
            if (selectedDocumentIds.has(document.document_id)) return false;
            if (document.document_status !== "active") return false;

            if (!keyword) return true;

            const name = document.document_name?.toLowerCase() || "";
            const description =
                document.document_description?.toLowerCase() || "";

            return name.includes(keyword) || description.includes(keyword);
        });
    }, [documents, search, selectedDocumentIds]);

    const handleAddDocument = (document: Document) => {
        setSelectedDocuments((prev) => [...prev, document]);
    };

    const handleRemoveDocument = (document_id: number) => {
        setSelectedDocuments((prev) =>
            prev.filter((document) => document.document_id !== document_id)
        );
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMessage("");

        if (!formData.template_name.trim()) {
            setErrorMessage("Template name is required");
            return;
        }

        editTemplateMutation.mutate();
    };

    const isLoading = isDocumentsLoading || isTemplateLoading;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form
                onSubmit={handleSubmit}
                className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <h3 className="text-xl font-bold text-gray-950">
                        Edit Document Template
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
                    >
                        <RxCross2 className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Template Name
                            </p>

                            <input
                                type="text"
                                value={formData.template_name}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        template_name: e.target.value,
                                    }))
                                }
                                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Status
                            </p>

                            <select
                                value={formData.template_status}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        template_status: e.target.value as
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

                        <label className="flex flex-col gap-2 md:col-span-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Template Description
                            </p>

                            <textarea
                                rows={4}
                                value={formData.template_description}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        template_description: e.target.value,
                                    }))
                                }
                                placeholder="Example: Standard requirements for residential lot buyers"
                                className="resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>
                    </div>

                    <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-gray-950">
                                Template Documents
                            </h3>
                            <p className="text-sm text-gray-600">
                                Edit the documents inside this template.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <div className="mb-3 flex flex-col gap-1">
                                <h3 className="text-sm font-bold text-gray-950">
                                    Add Existing Documents
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Search active documents and add them to this template.
                                </p>
                            </div>

                            <div className="relative mb-4">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search document library..."
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            {isLoading ? (
                                <p className="text-sm text-gray-500">
                                    Loading documents...
                                </p>
                            ) : availableDocuments.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                                    No available documents found.
                                </p>
                            ) : (
                                <div className="grid max-h-[220px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                                    {availableDocuments.map((document) => (
                                        <div
                                            key={document.document_id}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                                        >
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-bold text-gray-950">
                                                    {document.document_name}
                                                </h3>
                                                <p className="text-xs text-gray-500">
                                                    {document.document_description ||
                                                        "No description"}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleAddDocument(document)
                                                }
                                                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedDocuments.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5">
                                <p className="text-sm text-gray-500">
                                    No documents added to this template yet.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {selectedDocuments.map((document) => (
                                    <div
                                        key={document.document_id}
                                        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-5 md:items-center"
                                    >
                                        <div className="flex min-w-0 flex-col gap-1 md:col-span-2">
                                            <h3 className="truncate text-sm font-bold text-gray-950">
                                                {document.document_name}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {document.document_description ||
                                                    "No description"}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-xs font-semibold text-gray-600">
                                                Requirement
                                            </h3>
                                            <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                                {document.document_is_required
                                                    ? "Required"
                                                    : "Optional"}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-xs font-semibold text-gray-600">
                                                Status
                                            </h3>
                                            <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                                {document.document_status}
                                            </p>
                                        </div>

                                        <div className="flex md:justify-end">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleRemoveDocument(
                                                        document.document_id
                                                    )
                                                }
                                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {errorMessage && (
                            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {errorMessage}
                            </p>
                        )}
                    </div>
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
                        disabled={editTemplateMutation.isPending}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {editTemplateMutation.isPending
                            ? "Saving..."
                            : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditDocumentTemplate;
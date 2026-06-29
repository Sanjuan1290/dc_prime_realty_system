import { useMemo, useState } from "react";
import { FiSearch, FiEdit2, FiTrash2 } from "react-icons/fi";
import { FaCircle } from "react-icons/fa6";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Template, DocumentTemplateList } from "../../../types/document";
import { formatDateTime } from "../../../utils/formatDateTime";

type TemplatesResponse = {
    success: boolean;
    templates: Template[];
    template_documents: DocumentTemplateList[];
};

type Props = {
    onEditTemplate: (template: Template) => void;
};

const DocumentTemplates = ({ onEditTemplate }: Props) => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");

    const { data, isLoading, isError } = useQuery<TemplatesResponse>({
        queryKey: ["templates"],
        queryFn: async () => {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/documents/getTemplates`
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Templates retrieve failed!");
            }

            return data;
        },
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: async (template_id: number) => {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/documents/deleteTemplate/${template_id}`,
                {
                    method: "DELETE",
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to delete template");
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
        },
    });

    const templates = data?.templates || [];
    const templateDocuments = data?.template_documents || [];

    const filteredTemplates = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) return templates;

        return templates.filter((template) => {
            const name = template.template_name?.toLowerCase() || "";
            const description = template.template_description?.toLowerCase() || "";
            const status = template.template_status?.toLowerCase() || "";

            return (
                name.includes(keyword) ||
                description.includes(keyword) ||
                status.includes(keyword)
            );
        });
    }, [templates, search]);

    const handleDelete = (template_id: number) => {
        const confirmed = window.confirm("Delete this template?");
        if (!confirmed) return;

        deleteTemplateMutation.mutate(template_id);
    };

    if (isLoading) return <p>Loading...</p>;
    if (isError) return <p>Something went wrong. Try again later.</p>;

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-gray-900">
                    Document Templates
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-gray-600">
                    A template contains many documents. Projects can select a template, then still edit, add, or remove documents.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-md">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
                    />
                </div>

                <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                >
                    Reset
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="hidden grid-cols-6 border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-bold text-gray-700 md:grid">
                    <p className="col-span-2">Template</p>
                    <p>Documents</p>
                    <p>Status</p>
                    <p>Updated</p>
                    <p className="text-right">Actions</p>
                </div>

                {filteredTemplates.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-gray-500">
                        No templates found.
                    </div>
                ) : (
                    filteredTemplates.map((template) => {
                        const documents = templateDocuments.filter(
                            (item) => item.template_id === template.template_id
                        );

                        const requiredCount = documents.filter((item) =>
                            Boolean(item.document_is_required)
                        ).length;

                        return (
                            <div
                                key={template.template_id}
                                className="grid gap-4 border-b border-gray-100 px-5 py-4 text-sm text-gray-700 last:border-b-0 md:grid-cols-6 md:items-center"
                            >
                                <div className="col-span-2 flex flex-col gap-1">
                                    <h3 className="font-bold text-gray-900">
                                        {template.template_name}
                                    </h3>
                                    <p className="text-gray-500">
                                        {template.template_description || "No description"}
                                    </p>
                                </div>

                                <p className="text-gray-700">
                                    {documents.length} docs / {requiredCount} required
                                </p>

                                <p
                                    className={`flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                                        template.template_status === "active"
                                            ? "border-green-500 bg-green-100 text-green-800"
                                            : "border-red-500 bg-red-100 text-red-800"
                                    }`}
                                >
                                    <FaCircle className="h-2 w-2" />
                                    {template.template_status}
                                </p>

                                <p className="text-gray-600">
                                    {formatDateTime(
                                        template.template_updated_at ||
                                            template.template_created_at
                                    )}
                                </p>

                                <div className="flex items-center gap-2 md:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => onEditTemplate(template)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                                    >
                                        <FiEdit2 className="h-4 w-4" />
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(template.template_id)}
                                        disabled={deleteTemplateMutation.isPending}
                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <FiTrash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DocumentTemplates;
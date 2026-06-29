import { FiFileText, FiLayers, FiPlus } from "react-icons/fi";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
    Document as DocumentType,
    Template,
    DocumentTemplateList,
} from "../../types/document";
import PageHeader from "../../components/Shared/PageHeader";
import DocumentTemplates from "../../components/System/DocumentComponent/DocumentTemplates";
import Document_Library from "../../components/System/DocumentComponent/DocumentLibrary";
import DocumentAddTemplate from "../../components/System/DocumentComponent/DocumentAddTemplate";
import AddDocument from "../../components/System/DocumentComponent/AddDocument";
import EditDocument from "../../components/System/DocumentComponent/EditDocument";
import EditDocumentTemplate from "../../components/System/DocumentComponent/EditDocumentTemplate";

type TemplatesResponse = {
    success: boolean;
    templates: Template[];
    template_documents: DocumentTemplateList[];
};

const Document = () => {
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);

    const [selectedDocument, setSelectedDocument] =
        useState<DocumentType | null>(null);

    const [selectedTemplate, setSelectedTemplate] =
        useState<Template | null>(null);

    const { data: documents = [] } = useQuery<DocumentType[]>({
        queryKey: ["documents"],
        queryFn: async () => {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/documents/getDocuments`
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Document retrieve failed");
            }

            return data.documents || [];
        },
    });

    const { data: templateData } = useQuery<TemplatesResponse>({
        queryKey: ["templates"],
        queryFn: async () => {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/documents/getTemplates`
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Template retrieve failed");
            }

            return data;
        },
    });

    const templates = templateData?.templates || [];

    const libraryDocumentsCount = documents.length;

    const activeDocumentsCount = documents.filter(
        (document) => document.document_status === "active"
    ).length;

    const templatesCount = templates.length;

    const activeTemplatesCount = templates.filter(
        (template) => template.template_status === "active"
    ).length;

    return (
        <main className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <PageHeader
                    title="Document Library"
                    description="Manage reusable documents and template checklists for projects and listings"
                    icon={FiFileText}
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                        type="button"
                        onClick={() => setShowAddTemplateModal(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-900 hover:text-white active:scale-[0.98]"
                    >
                        <FiLayers className="h-4 w-4" />
                        Add Template
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowAddDocumentModal(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                    >
                        <FiPlus className="h-4 w-4" />
                        Add Document
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <h4 className="text-sm font-semibold text-gray-500">
                        Library Documents
                    </h4>
                    <p className="text-3xl font-bold text-gray-900">
                        {libraryDocumentsCount}
                    </p>
                </div>

                <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <h4 className="text-sm font-semibold text-gray-500">
                        Active Documents
                    </h4>
                    <p className="text-3xl font-bold text-gray-900">
                        {activeDocumentsCount}
                    </p>
                </div>

                <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <h4 className="text-sm font-semibold text-gray-500">
                        Templates
                    </h4>
                    <p className="text-3xl font-bold text-gray-900">
                        {templatesCount}
                    </p>
                </div>

                <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <h4 className="text-sm font-semibold text-gray-500">
                        Active Templates
                    </h4>
                    <p className="text-3xl font-bold text-gray-900">
                        {activeTemplatesCount}
                    </p>
                </div>
            </div>

            <DocumentTemplates onEditTemplate={setSelectedTemplate} />
            <Document_Library onEditDocument={setSelectedDocument} />

            {showAddTemplateModal && (
                <DocumentAddTemplate
                    setShowAddTemplateModal={setShowAddTemplateModal}
                />
            )}

            {showAddDocumentModal && (
                <AddDocument
                    setShowAddDocumentModal={setShowAddDocumentModal}
                />
            )}

            {selectedDocument && (
                <EditDocument
                    document={selectedDocument}
                    onClose={() => setSelectedDocument(null)}
                />
            )}

            {selectedTemplate && (
                <EditDocumentTemplate
                    template={selectedTemplate}
                    onClose={() => setSelectedTemplate(null)}
                />
            )}
        </main>
    );
};

export default Document;
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiFileText, FiLayers, FiPlus } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import ReadOnlyNotice from "../../components/Shared/ReadOnlyNotice";
import useCurrentUser from "../../utils/useCurrentUser";
import DocumentTemplates from "../../components/System/documentComponents/DocumentTemplates";
import Document_Library from "../../components/System/documentComponents/DocumentLibrary";
import DocumentAddTemplate from "../../components/System/documentComponents/DocumentAddTemplate";
import AddDocument from "../../components/System/documentComponents/AddDocument";
import EditDocument from "../../components/System/documentComponents/EditDocument";
import EditDocumentTemplate from "../../components/System/documentComponents/EditDocumentTemplate";
import { useFetch } from "../../utils/useFetch";

const Document = () => {
  const { data: currentUserData } = useCurrentUser();
  const canManage = currentUserData?.user?.role === "super_admin";
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [alert, setAlert] = useState(null);

  const {
    data: documentsData,
    isLoading: isDocumentsLoading,
    isFetching: isDocumentsFetching,
    isError: isDocumentsError,
    error: documentsError,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: () => useFetch("/documents/getDocuments"),
  });

  const {
    data: templateData,
    isLoading: isTemplatesLoading,
    isFetching: isTemplatesFetching,
    isError: isTemplatesError,
    error: templatesError,
  } = useQuery({
    queryKey: ["templates"],
    queryFn: () => useFetch("/documents/getTemplates"),
  });

  const documents = documentsData?.documents || [];
  const templates = templateData?.templates || [];
  const templateDocuments = templateData?.template_documents || [];

  const isInitialLoading = isDocumentsLoading || isTemplatesLoading;
  const isRefreshing = !isInitialLoading && (isDocumentsFetching || isTemplatesFetching);
  const loadError = documentsError?.message || templatesError?.message || "Failed to load document records.";

  const libraryDocumentsCount = documents.length;
  const activeDocumentsCount = documents.filter((document) => document.document_status === "active").length;
  const templatesCount = templates.length;
  const activeTemplatesCount = templates.filter((template) => template.template_status === "active").length;

  const handleSaved = (message) => {
    setAlert({ type: "success", message });
  };

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <PageHeader
          title="Document Library"
          description="Manage reusable documents and template checklists for projects and listings"
          icon={FiFileText}
        />

        {canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setShowAddTemplateModal(true)} disabled={isInitialLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-900 hover:text-white disabled:opacity-60"><FiLayers className="h-4 w-4" />Add Template</button>
            <button type="button" onClick={() => setShowAddDocumentModal(true)} disabled={isInitialLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-blue-300"><FiPlus className="h-4 w-4" />Add Document</button>
          </div>
        ) : null}
      </div>

      {!canManage ? <ReadOnlyNotice message="Admin can review documents and templates. Only a Super Admin can add, edit, or delete them." /> : null}
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {isInitialLoading ? <StatusAlert type="loading" message="Loading document records..." /> : null}
      {isRefreshing ? <StatusAlert type="info" message="Refreshing document records..." /> : null}
      {isDocumentsError || isTemplatesError ? <StatusAlert type="error" message={loadError} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <h4 className="text-sm font-semibold text-gray-500">Library Documents</h4>
          <p className="text-3xl font-bold text-gray-900">{libraryDocumentsCount}</p>
        </div>
        <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <h4 className="text-sm font-semibold text-gray-500">Active Documents</h4>
          <p className="text-3xl font-bold text-gray-900">{activeDocumentsCount}</p>
        </div>
        <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <h4 className="text-sm font-semibold text-gray-500">Templates</h4>
          <p className="text-3xl font-bold text-gray-900">{templatesCount}</p>
        </div>
        <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <h4 className="text-sm font-semibold text-gray-500">Active Templates</h4>
          <p className="text-3xl font-bold text-gray-900">{activeTemplatesCount}</p>
        </div>
      </div>

      <DocumentTemplates templates={templates} templateDocuments={templateDocuments} onEditTemplate={setSelectedTemplate} canManage={canManage} />
      <Document_Library documents={documents} onEditDocument={setSelectedDocument} canManage={canManage} />

      {showAddTemplateModal && canManage ? (
        <DocumentAddTemplate documents={documents} setShowAddTemplateModal={setShowAddTemplateModal} onSaved={handleSaved} />
      ) : null}
      {showAddDocumentModal && canManage ? <AddDocument setShowAddDocumentModal={setShowAddDocumentModal} onSaved={handleSaved} /> : null}
      {selectedDocument && canManage ? <EditDocument document={selectedDocument} onClose={() => setSelectedDocument(null)} onSaved={handleSaved} /> : null}
      {selectedTemplate && canManage ? (
        <EditDocumentTemplate
          template={selectedTemplate}
          documents={documents}
          templateDocuments={templateDocuments}
          onClose={() => setSelectedTemplate(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </main>
  );
};

export default Document;

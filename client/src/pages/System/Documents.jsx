import { useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiFileText,
  FiLayers,
  FiPlus,
} from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import DocumentTemplates from "../../components/System/documentComponents/DocumentTemplates";
import Document_Library from "../../components/System/documentComponents/DocumentLibrary";
import DocumentAddTemplate from "../../components/System/documentComponents/DocumentAddTemplate";
// import AddDocument from "../../components/System/documentComponents/AddDocument";
import EditDocument from "../../components/System/documentComponents/EditDocument";
import EditDocumentTemplate from "../../components/System/documentComponents/EditDocumentTemplate";

const documents = [
  {
    document_id: 1,
    document_name: "Valid Government ID",
    document_description: "One clear copy of a government-issued valid ID.",
    document_is_reusable: true,
    document_is_required: true,
    document_status: "active",
    document_created_at: "2026-06-18 09:00",
    document_updated_at: "2026-06-21 13:20",
  },
  {
    document_id: 2,
    document_name: "Proof of Billing",
    document_description: "Recent utility bill or billing statement under the buyer name.",
    document_is_reusable: true,
    document_is_required: false,
    document_status: "active",
    document_created_at: "2026-06-18 09:20",
    document_updated_at: "2026-06-22 10:30",
  },
  {
    document_id: 3,
    document_name: "Proof of Income",
    document_description: "Payslip, certificate of employment, business permit, or voucher.",
    document_is_reusable: false,
    document_is_required: true,
    document_status: "active",
    document_created_at: "2026-06-19 11:00",
    document_updated_at: "2026-06-24 15:10",
  },
  {
    document_id: 4,
    document_name: "Marriage Certificate",
    document_description: "Required for spouse buyer profile when applicable.",
    document_is_reusable: false,
    document_is_required: false,
    document_status: "inactive",
    document_created_at: "2026-06-20 08:00",
    document_updated_at: "2026-06-20 08:00",
  },
];

const templates = [
  {
    template_id: 1,
    template_name: "Standard Lot Buyer Checklist",
    template_description: "Default document checklist for regular residential lot buyers.",
    template_status: "active",
    document_ids: [1, 2, 3],
    template_created_at: "2026-06-22 08:00",
    template_updated_at: "2026-06-24 10:15",
  },
  {
    template_id: 2,
    template_name: "Spouse Buyer Checklist",
    template_description: "Additional requirements for married buyers and co-buyers.",
    template_status: "active",
    document_ids: [1, 2, 3, 4],
    template_created_at: "2026-06-23 09:30",
    template_updated_at: "2026-06-25 14:00",
  },
  {
    template_id: 3,
    template_name: "Old Reservation Checklist",
    template_description: "Previous checklist kept for reference only.",
    template_status: "inactive",
    document_ids: [1, 2],
    template_created_at: "2026-06-10 13:00",
    template_updated_at: "2026-06-18 16:45",
  },
];

const StatCard = ({ title, value, description, icon: Icon }) => (
  <div className="group flex min-h-[130px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      </div>

      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
    </div>

    <p className="mt-4 text-xs font-medium text-slate-500">{description}</p>
  </div>
);

const Documents = () => {
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const summary = useMemo(() => {
    const activeDocumentsCount = documents.filter(
      (document) => document.document_status === "active"
    ).length;

    const activeTemplatesCount = templates.filter(
      (template) => template.template_status === "active"
    ).length;

    return {
      libraryDocumentsCount: documents.length,
      activeDocumentsCount,
      templatesCount: templates.length,
      activeTemplatesCount,
    };
  }, []);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <PageHeader
          title="Document Library"
          description="Manage reusable documents and template checklists for projects and listings."
          icon={FiFileText}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowAddTemplateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-950 hover:text-white active:scale-[0.98]"
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
        <StatCard
          title="Library Documents"
          value={summary.libraryDocumentsCount}
          description="Reusable master files"
          icon={FiFileText}
        />
        <StatCard
          title="Active Documents"
          value={summary.activeDocumentsCount}
          description="Available for checklists"
          icon={FiCheckCircle}
        />
        <StatCard
          title="Templates"
          value={summary.templatesCount}
          description="Reusable checklist groups"
          icon={FiLayers}
        />
        <StatCard
          title="Active Templates"
          value={summary.activeTemplatesCount}
          description="Ready for project use"
          icon={FiCheckCircle}
        />
      </div>

      <DocumentTemplates
        templates={templates}
        documents={documents}
        onEditTemplate={setSelectedTemplate}
      />

      <Document_Library
        documents={documents}
        onEditDocument={setSelectedDocument}
      />

      {showAddTemplateModal && (
        <DocumentAddTemplate
          documents={documents}
          setShowAddTemplateModal={setShowAddTemplateModal}
        />
      )}

      {showAddDocumentModal && (
        <AddDocument setShowAddDocumentModal={setShowAddDocumentModal} />
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
          documents={documents}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </main>
  );
};

export default Documents;

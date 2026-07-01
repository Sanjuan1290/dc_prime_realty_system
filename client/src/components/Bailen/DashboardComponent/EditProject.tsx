import { useEffect, useMemo, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiAlertCircle,
  FiCheck,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { GrDocumentText } from "react-icons/gr";

import type {
  Document,
  DocumentTemplateList,
  Template,
} from "../../../types/document";
import type { ProjectBailen } from "../../../types/project";

type Props = {
  setIsEditProjectModalOpen: Dispatch<SetStateAction<boolean>>;
};

type ProjectResponse = {
  success: boolean;
  data: ProjectBailen;
};

type DocumentsResponse = {
  success: boolean;
  documents: Document[];
};

type TemplatesResponse = {
  success: boolean;
  templates: Template[];
  template_documents: DocumentTemplateList[];
};

type BailenDefaultDocument = {
  default_document_id: number;
  project_bailen_id: number;
  document_id: number;
  document_name: string;
  document_description: string | null;
  document_is_reusable: boolean | 0 | 1;
  document_status: "active" | "inactive";
  document_is_required: boolean | 0 | 1;
};

type BailenDocumentsResponse = {
  success: boolean;
  data: BailenDefaultDocument[];
};

type ProjectForm = {
  project_bailen_name: string;
  project_bailen_location: string;
  project_bailen_location_code: string;
  project_bailen_administrator_name: string;
  project_bailen_tax_declaration_no: string;
  project_bailen_pin: string;
  project_bailen_status: "active" | "inactive";
};

type SelectedDocument = {
  document_id: number;
  document_name: string;
  document_description: string | null;
  document_status: "active" | "inactive";
  document_is_required: boolean | 0 | 1;
};

type FieldProps = {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

const Field = ({
  label,
  type = "text",
  placeholder = "",
  value,
  onChange,
}: FieldProps) => {
  return (
    <div className="flex flex-col gap-1">
      {label.trim() !== "" && (
        <label className="text-sm font-bold tracking-wide text-slate-700">
          {label}
        </label>
      )}

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
};

const EditProject = ({ setIsEditProjectModalOpen }: Props) => {
  const queryClient = useQueryClient();

  const [templateSearch, setTemplateSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<ProjectForm>({
    project_bailen_name: "",
    project_bailen_location: "",
    project_bailen_location_code: "",
    project_bailen_administrator_name: "",
    project_bailen_tax_declaration_no: "",
    project_bailen_pin: "",
    project_bailen_status: "active",
  });

  const [selectedDocuments, setSelectedDocuments] = useState<SelectedDocument[]>(
    []
  );

  const { data: projectData, isLoading: isProjectLoading } =
    useQuery<ProjectResponse>({
      queryKey: ["bailen-project"],
      queryFn: async () => {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/bailen/project/getProject`,
          {
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch Bailen project.");
        }

        return data;
      },
    });

  const { data: bailenDocumentsData, isLoading: isBailenDocumentsLoading } =
    useQuery<BailenDocumentsResponse>({
      queryKey: ["bailen-documents"],
      queryFn: async () => {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/bailen/project/getDocuments`,
          {
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch Bailen documents.");
        }

        return data;
      },
    });

  const { data: documentsData, isLoading: isDocumentsLoading } =
    useQuery<DocumentsResponse>({
      queryKey: ["documents"],
      queryFn: async () => {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/documents/getDocuments`,
          {
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch documents.");
        }

        return data;
      },
    });

  const { data: templatesData, isLoading: isTemplatesLoading } =
    useQuery<TemplatesResponse>({
      queryKey: ["templates"],
      queryFn: async () => {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/documents/getTemplates`,
          {
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch templates.");
        }

        return data;
      },
    });

  const documents = documentsData?.documents || [];
  const templates = templatesData?.templates || [];
  const templateDocuments = templatesData?.template_documents || [];
  const bailenDefaultDocuments = bailenDocumentsData?.data || [];

  const selectedDocumentIds = useMemo(() => {
    return new Set(selectedDocuments.map((document) => document.document_id));
  }, [selectedDocuments]);

  const documentById = useMemo(() => {
    return new Map(documents.map((document) => [document.document_id, document]));
  }, [documents]);

  useEffect(() => {
    const project = projectData?.data;

    if (!project) return;

    setFormData({
      project_bailen_name: project.project_bailen_name || "",
      project_bailen_location: project.project_bailen_location || "",
      project_bailen_location_code: project.project_bailen_location_code || "",
      project_bailen_administrator_name:
        project.project_bailen_administrator_name || "",
      project_bailen_tax_declaration_no:
        project.project_bailen_tax_declaration_no || "",
      project_bailen_pin: project.project_bailen_pin || "",
      project_bailen_status: project.project_bailen_status || "active",
    });
  }, [projectData]);

  useEffect(() => {
    if (!bailenDefaultDocuments.length) {
      setSelectedDocuments([]);
      return;
    }

    setSelectedDocuments(
      bailenDefaultDocuments.map((document) => ({
        document_id: document.document_id,
        document_name: document.document_name,
        document_description: document.document_description,
        document_status: document.document_status,
        document_is_required: document.document_is_required,
      }))
    );
  }, [bailenDefaultDocuments]);

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase();

    return templates.filter((template) => {
      if (template.template_status !== "active") return false;
      if (!keyword) return true;

      const name = template.template_name?.toLowerCase() || "";
      const description = template.template_description?.toLowerCase() || "";

      return name.includes(keyword) || description.includes(keyword);
    });
  }, [templates, templateSearch]);

  const availableDocuments = useMemo(() => {
    const keyword = documentSearch.trim().toLowerCase();

    return documents.filter((document) => {
      if (document.document_status !== "active") return false;
      if (selectedDocumentIds.has(document.document_id)) return false;

      if (!keyword) return true;

      const name = document.document_name?.toLowerCase() || "";
      const description = document.document_description?.toLowerCase() || "";

      return name.includes(keyword) || description.includes(keyword);
    });
  }, [documents, selectedDocumentIds, documentSearch]);

  const requiredCount = selectedDocuments.filter(
    (document) => Number(document.document_is_required) === 1
  ).length;

  const optionalCount = selectedDocuments.length - requiredCount;

  const getTemplateDocs = (templateId: number) => {
    return templateDocuments.filter(
      (document) => document.template_id === templateId
    );
  };

  const normalizeTemplateDocument = (
    templateDocument: DocumentTemplateList
  ): SelectedDocument => {
    const libraryDocument = documentById.get(templateDocument.document_id);

    return {
      document_id: templateDocument.document_id,
      document_name:
        templateDocument.document_name ||
        libraryDocument?.document_name ||
        "Untitled document",
      document_description:
        templateDocument.document_description ??
        libraryDocument?.document_description ??
        null,
      document_status:
        templateDocument.document_status ||
        libraryDocument?.document_status ||
        "active",
      document_is_required:
        templateDocument.document_is_required ??
        libraryDocument?.document_is_required ??
        1,
    };
  };

  const addDocument = (document: SelectedDocument) => {
    setSelectedDocuments((current) => {
      const exists = current.some(
        (item) => item.document_id === document.document_id
      );

      if (exists) return current;

      return [...current, document];
    });
  };

  const removeDocument = (documentId: number) => {
    setSelectedDocuments((current) =>
      current.filter((document) => document.document_id !== documentId)
    );
  };

  const addLibraryDocument = (document: Document) => {
    addDocument({
      document_id: document.document_id,
      document_name: document.document_name,
      document_description: document.document_description,
      document_status: document.document_status,
      document_is_required: document.document_is_required,
    });
  };

  const toggleTemplate = (template: Template) => {
    const docs = getTemplateDocs(template.template_id);
    const templateDocumentIds = docs.map((document) => document.document_id);

    const allSelected = templateDocumentIds.every((documentId) =>
      selectedDocumentIds.has(documentId)
    );

    if (allSelected) {
      setSelectedDocuments((current) =>
        current.filter(
          (document) => !templateDocumentIds.includes(document.document_id)
        )
      );

      return;
    }

    setSelectedDocuments((current) => {
      const existingIds = new Set(
        current.map((document) => document.document_id)
      );

      const newDocs = docs
        .filter((document) => !existingIds.has(document.document_id))
        .map(normalizeTemplateDocument);

      return [...current, ...newDocs];
    });
  };

  const useAllTemplates = () => {
    const activeTemplateIds = templates
      .filter((template) => template.template_status === "active")
      .map((template) => template.template_id);

    const docs = templateDocuments.filter((document) =>
      activeTemplateIds.includes(document.template_id)
    );

    setSelectedDocuments((current) => {
      const existingIds = new Set(
        current.map((document) => document.document_id)
      );

      const newDocs = docs
        .filter((document) => !existingIds.has(document.document_id))
        .map(normalizeTemplateDocument);

      return [...current, ...newDocs];
    });
  };

  const useAllLibraryDocs = () => {
    setSelectedDocuments((current) => {
      const existingIds = new Set(
        current.map((document) => document.document_id)
      );

      const newDocs = documents
        .filter((document) => document.document_status === "active")
        .filter((document) => !existingIds.has(document.document_id))
        .map((document) => ({
          document_id: document.document_id,
          document_name: document.document_name,
          document_description: document.document_description,
          document_status: document.document_status,
          document_is_required: document.document_is_required,
        }));

      return [...current, ...newDocs];
    });
  };

  const editProjectMutation = useMutation({
    mutationFn: async () => {
      const projectId = projectData?.data?.project_bailen_id;

      if (!projectId) {
        throw new Error("Bailen project ID is missing.");
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/bailen/project/edit`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_bailen_id: projectId,
            ...formData,
            document_ids: selectedDocuments.map(
              (document) => document.document_id
            ),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update Bailen project.");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bailen-project"] });
      queryClient.invalidateQueries({ queryKey: ["bailen-documents"] });
      setIsEditProjectModalOpen(false);
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update Bailen project."
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    editProjectMutation.mutate();
  };

  const isLoading =
    isProjectLoading ||
    isBailenDocumentsLoading ||
    isDocumentsLoading ||
    isTemplatesLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-950">
              EDIT BAILEN PROJECT
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Update project details and default document requirements.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsEditProjectModalOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-96 items-center justify-center">
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">
              Loading project details...
            </p>
          </div>
        ) : (
          <div className="grid max-h-[calc(92vh-144px)] grid-cols-1 gap-4 overflow-y-auto p-4 text-sm lg:grid-cols-[430px_1fr]">
            <div className="space-y-4">
              <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-bold text-slate-950">Project Information</p>
                  <p className="text-sm text-slate-500">
                    Basic Bailen project details and status.
                  </p>
                </div>

                <Field
                  label="Project name"
                  value={formData.project_bailen_name}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      project_bailen_name: value,
                    }))
                  }
                />

                <Field
                  label="Location"
                  value={formData.project_bailen_location}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      project_bailen_location: value,
                    }))
                  }
                />

                <Field
                  label="Location Code"
                  placeholder="ex. LA, PE"
                  value={formData.project_bailen_location_code}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      project_bailen_location_code: value.toUpperCase(),
                    }))
                  }
                />

                <Field
                  label="Administrator"
                  placeholder="Enter administrator name"
                  value={formData.project_bailen_administrator_name}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      project_bailen_administrator_name: value,
                    }))
                  }
                />

                <Field
                  label="Tax declaration no."
                  placeholder="AA-06-0005-xxxxx"
                  value={formData.project_bailen_tax_declaration_no}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      project_bailen_tax_declaration_no: value,
                    }))
                  }
                />

                <Field
                  label="PIN"
                  placeholder="022-06-0005-xxx-xx"
                  value={formData.project_bailen_pin}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      project_bailen_pin: value,
                    }))
                  }
                />

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold tracking-wide text-slate-700">
                    Status
                  </label>

                  <select
                    value={formData.project_bailen_status}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        project_bailen_status: event.target.value as
                          | "active"
                          | "inactive",
                      }))
                    }
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <GrDocumentText className="mt-1 text-slate-700" />
                  <div>
                    <h3 className="font-bold text-slate-950">
                      Document Templates
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Pick templates to add their documents to Bailen defaults.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={useAllTemplates}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm duration-300 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Select All Templates
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDocuments([])}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    Clear Documents
                  </button>

                  <button
                    type="button"
                    onClick={useAllLibraryDocs}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm duration-300 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 sm:col-span-2"
                  >
                    Use All Library Docs
                  </button>
                </div>

                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                  {filteredTemplates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-500">
                      No templates found.
                    </div>
                  ) : (
                    filteredTemplates.map((template) => {
                      const docs = getTemplateDocs(template.template_id);
                      const isChecked =
                        docs.length > 0 &&
                        docs.every((document) =>
                          selectedDocumentIds.has(document.document_id)
                        );

                      return (
                        <button
                          type="button"
                          key={template.template_id}
                          onClick={() => toggleTemplate(template)}
                          className={[
                            "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left shadow-sm duration-300",
                            isChecked
                              ? "border-blue-200 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              isChecked
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white",
                            ].join(" ")}
                          >
                            {isChecked && <FiCheck className="h-3 w-3" />}
                          </span>

                          <span>
                            <p className="font-bold text-slate-950">
                              {template.template_name}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              {template.template_description || "No description"}
                            </p>
                            <p className="mt-2 text-xs font-bold text-slate-600">
                              {docs.length} docs
                            </p>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <div className="flex min-h-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-col gap-1 text-slate-500">
                  <div className="flex items-center gap-2 text-base text-slate-950">
                    <GrDocumentText />
                    <h3 className="font-bold">
                      Default Document Requirements
                    </h3>
                  </div>
                  <p className="text-sm">
                    These become the default checklist for Bailen listings.
                  </p>
                  <p className="text-sm">
                    Listings can still be customized later.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <p className="rounded-full bg-blue-50 px-3 py-1 text-center text-xs font-bold text-blue-700">
                    {selectedDocuments.length} documents
                  </p>
                  <p className="rounded-full bg-emerald-50 px-3 py-1 text-center text-xs font-bold text-emerald-700">
                    {requiredCount} required
                  </p>
                  <p className="rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-bold text-slate-600">
                    {optionalCount} optional
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-1">
                  <h3 className="font-bold text-slate-950">
                    Add Existing Documents
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create missing documents in the Document Library first, then
                    add them here.
                  </p>

                  <div className="relative mt-2">
                    <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={documentSearch}
                      onChange={(event) => setDocumentSearch(event.target.value)}
                      placeholder="Search document library..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid max-h-56 grid-cols-1 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                  {availableDocuments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-500 xl:col-span-2">
                      No available documents found.
                    </div>
                  ) : (
                    availableDocuments.map((document) => (
                      <div
                        key={document.document_id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-5 text-slate-950">
                            {document.document_name}
                          </p>
                          <span className="text-xs text-slate-500">
                            {document.document_description || "No description"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => addLibraryDocument(document)}
                          className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 shadow-sm duration-150 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
                {selectedDocuments.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <GrDocumentText className="text-3xl text-slate-300" />
                    <p className="mt-3 font-bold text-slate-700">
                      No default documents selected
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add documents from templates or the library.
                    </p>
                  </div>
                ) : (
                  selectedDocuments.map((document) => (
                    <div
                      key={document.document_id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid md:grid-cols-[1fr_120px_110px_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold leading-5 text-slate-950">
                          {document.document_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {document.document_description || "From library"}
                        </p>
                      </div>

                      <span
                        className={[
                          "rounded-full px-3 py-1 text-center text-xs font-bold",
                          Number(document.document_is_required) === 1
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {Number(document.document_is_required) === 1
                          ? "Required"
                          : "Optional"}
                      </span>

                      <span
                        className={[
                          "rounded-full px-3 py-1 text-center text-xs font-bold",
                          document.document_status === "active"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        {document.document_status}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeDocument(document.document_id)}
                        className="h-10 rounded-lg bg-red-600 px-4 text-sm font-bold tracking-wide text-white duration-150 hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {errorMessage ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <FiAlertCircle className="h-4 w-4" />
              {errorMessage}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              Review the project details before saving.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsEditProjectModalOpen(false)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 duration-150 hover:bg-slate-100"
            >
              <FiX className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["bailen-project"] });
                queryClient.invalidateQueries({
                  queryKey: ["bailen-documents"],
                });
                queryClient.invalidateQueries({ queryKey: ["documents"] });
                queryClient.invalidateQueries({ queryKey: ["templates"] });
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 duration-150 hover:bg-slate-100"
            >
              <FiRefreshCcw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="submit"
              disabled={editProjectMutation.isPending || isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <FiSave className="h-4 w-4" />
              {editProjectMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditProject;
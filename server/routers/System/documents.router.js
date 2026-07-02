import express from "express";
import {
  getDocuments,
  getTemplates,
  addDocument,
  addTemplate,
  editDocument,
  editTemplate,
  deleteDocument,
  deleteTemplate,
} from "../../controllers/System/documents.controller.js";

const router = express.Router();

router.get("/", getDocuments);
router.get("/templates", getTemplates);

router.post("/", addDocument);
router.post("/templates", addTemplate);

router.patch("/:documentId", editDocument);
router.patch("/templates/:templateId", editTemplate);

router.delete("/:documentId", deleteDocument);
router.delete("/templates/:templateId", deleteTemplate);

export default router;
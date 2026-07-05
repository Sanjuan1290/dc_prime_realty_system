import express from 'express';

import {
  getLotProjects,
  getLotProjectOptions,
  getLotProjectBySlug,
  createLotProject,
  toggleLotProjectStatus,
  deleteLotProject,
} from '../../controllers/System/projects.controller.js';

const router = express.Router();

router.get('/lot-projects', getLotProjects);
router.get('/lot-projects/options', getLotProjectOptions);
router.get('/lot-projects/:projectSlug', getLotProjectBySlug);

router.post('/lot-projects', createLotProject);
router.patch('/lot-projects/:id/status', toggleLotProjectStatus);
router.delete('/lot-projects/:id', deleteLotProject);

export default router;

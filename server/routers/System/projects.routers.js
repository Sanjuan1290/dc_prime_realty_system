import express from 'express';

import {
  getLotProjects,
  getLotProjectOptions,
  getLotProjectBySlug,
  createLotProject,
  updateLotProject,
  toggleLotProjectStatus,
} from '../../controllers/System/projects.controller.js';

const router = express.Router();

router.get('/lot-projects', getLotProjects);
router.get('/lot-projects/options', getLotProjectOptions);
router.get('/lot-projects/:projectSlug', getLotProjectBySlug);

router.post('/lot-projects', createLotProject);
router.put('/lot-projects/:id', updateLotProject);
router.patch('/lot-projects/:id/status', toggleLotProjectStatus);

export default router;
import express from 'express';
import {
  editProject,
  getActiveCadastralLots,
  getProjectDashboard,
  getRecentUnitRecords,
  printPriceList,
  viewProjectDetails,
} from '../../controllers/BailenProject/dashboard.controller.js';

const router = express.Router();

router.get('/', getProjectDashboard);
router.get('/recent-units', getRecentUnitRecords);
router.get('/project', viewProjectDetails);
router.get('/project/:id', viewProjectDetails);
router.put('/project/:id', editProject);
router.get('/project/:id/active-cadastral-lots', getActiveCadastralLots);
router.get('/project/:id/price-list/print', printPriceList);

export default router;

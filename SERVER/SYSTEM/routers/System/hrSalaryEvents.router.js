import { Router } from 'express';
import { receiveSalaryEvent } from '../../controllers/System/hrSalaryEvents.controller.js';
const router = Router();
router.post('/salary-events', receiveSalaryEvent);
export default router;

import { Router } from 'express';
import * as dashboardController from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.get('/summary', authenticate, dashboardController.getSummary);

export default router;


import { Router } from 'express';
import * as healthController from './health.controller.js';

const router = Router();

router.get('/ping', healthController.ping);
router.get('/health', healthController.health);
router.get('/health/ready', healthController.ready);

export default router;


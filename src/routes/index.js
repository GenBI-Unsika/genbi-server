import { Router } from 'express';

import authRoutes from './auth.routes.js';
import filesRoutes from './files.routes.js';
import meRoutes from './me.routes.js';
import scholarshipsRoutes from './scholarships.routes.js';
import masterDataRoutes from './master-data.routes.js';
import teamsRoutes from './teams.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/files', filesRoutes);
router.use('/me', meRoutes);
router.use('/scholarships', scholarshipsRoutes);
router.use('/master-data', masterDataRoutes);
router.use('/teams', teamsRoutes);

export default router;

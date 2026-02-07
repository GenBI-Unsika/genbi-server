import { Router } from 'express';

import authRoutes from './auth.routes.js';
import filesRoutes from './files.routes.js';
import meRoutes from './me.routes.js';
import scholarshipsRoutes from './scholarships.routes.js';
import masterDataRoutes from './master-data.routes.js';
import teamsRoutes from './teams.routes.js';
import eventsRoutes from './events.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import treasuryRoutes from './treasury.routes.js';
import dispensationsRoutes from './dispensations.routes.js';
import activitiesRoutes from './activities.routes.js';
import articlesRoutes from './articles.routes.js';
import googleCalendarRoutes from './google-calendar.routes.js';
import divisionsRoutes from './divisions.routes.js';
import siteSettingsRoutes from './site-settings.routes.js';
import usersRoutes from './users.routes.js';
import membersRoutes from './members.routes.js';
import analyticsRoutes from './analytics.routes.js';
import infoCenterRoutes from './info-center.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/files', filesRoutes);
// Back-compat alias used by some frontends (e.g. admin-genbi)
router.use('/upload', filesRoutes);
router.use('/me', meRoutes);
router.use('/scholarships', scholarshipsRoutes);
router.use('/master-data', masterDataRoutes);
router.use('/teams', teamsRoutes);
router.use('/events', eventsRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/treasury', treasuryRoutes);
router.use('/dispensations', dispensationsRoutes);
router.use('/activities', activitiesRoutes);
router.use('/articles', articlesRoutes);
router.use('/calendar', googleCalendarRoutes);
router.use('/divisions', divisionsRoutes);
router.use('/site-settings', siteSettingsRoutes);
router.use('/users', usersRoutes);
router.use('/members', membersRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/info-center', infoCenterRoutes);

export default router;

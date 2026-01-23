import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

// Public: get all active team members
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // On Windows, Prisma Client regeneration can fail (engine file lock).
    // If the client is stale, the TeamMember delegate may not exist yet.
    // Return empty data to avoid crashing the API and let the UI show empty state.
    if (!prisma?.teamMember?.findMany) {
      return res.json({ data: [] });
    }

    let members = [];
    try {
      members = await prisma.teamMember.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { division: 'asc' }, { name: 'asc' }],
      });
    } catch (e) {
      // If migration hasn't been applied yet, the table won't exist.
      // Treat that as empty dataset.
      if (e?.code === 'P2021') {
        return res.json({ data: [] });
      }
      throw e;
    }

    res.json({ data: members });
  }),
);

export default router;

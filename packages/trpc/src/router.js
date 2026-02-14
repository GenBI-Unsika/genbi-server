import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '../../../src/db/prisma.js';
import { setRegistrationSchema } from '@genbi/contracts';

const t = initTRPC.context().create();

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth?.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthenticated' });
  }
  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  // Keep consistent with server-side ADMIN_ROLES (see genbi-server/src/middleware/auth.js)
  // Token role values use snake_case (e.g. 'super_admin'), not just 'admin'.
  const role = ctx.auth?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden' });
  }
  return next({ ctx });
});

const SETTING_KEY_REG_OPEN = 'scholarship_registration_open';
const SETTING_KEY_PERIOD = 'scholarship_period';

const setPeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  batch: z.number().int().min(1).max(2),
});

async function getRegistrationOpen() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_REG_OPEN } });
  return Boolean(row?.value?.open);
}

async function getCurrentPeriod() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PERIOD } });
  const year = Number(row?.value?.year);
  const batch = Number(row?.value?.batch);

  if (Number.isInteger(year) && year > 2000 && Number.isInteger(batch) && batch > 0) {
    return { year, batch };
  }

  // Default to current year and batch 1
  return { year: new Date().getFullYear(), batch: 1 };
}

export const appRouter = t.router({
  health: publicProcedure.query(({ ctx }) => {
    return {
      ok: true,
      auth: ctx.auth ? { userId: ctx.auth.userId, role: ctx.auth.role } : null,
    };
  }),

  me: t.router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.auth.userId },
        include: { profile: true, role: true },
      });

      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      return {
        id: user.id,
        email: user.email,
        role: user.role?.name || 'awardee',
        profile: user.profile,
      };
    }),
  }),

  scholarships: t.router({
    getRegistration: publicProcedure.query(async () => {
      const open = await getRegistrationOpen();
      const period = await getCurrentPeriod();
      return { open, year: period.year, batch: period.batch };
    }),

    setRegistration: adminProcedure.input(setRegistrationSchema).mutation(async ({ input }) => {
      const row = await prisma.appSetting.upsert({
        where: { key: SETTING_KEY_REG_OPEN },
        update: { value: { open: input.open } },
        create: { key: SETTING_KEY_REG_OPEN, value: { open: input.open } },
      });

      return { open: Boolean(row?.value?.open) };
    }),

    setPeriod: adminProcedure.input(setPeriodSchema).mutation(async ({ input }) => {
      const row = await prisma.appSetting.upsert({
        where: { key: SETTING_KEY_PERIOD },
        update: { value: { year: input.year, batch: input.batch } },
        create: { key: SETTING_KEY_PERIOD, value: { year: input.year, batch: input.batch } },
      });

      return { year: Number(row?.value?.year) || input.year, batch: Number(row?.value?.batch) || input.batch };
    }),
  }),

  echo: publicProcedure.input(z.object({ message: z.string().min(1) })).mutation(({ input }) => {
    return { message: input.message };
  }),
});

export const createCaller = t.createCallerFactory(appRouter);

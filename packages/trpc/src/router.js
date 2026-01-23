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
  if (ctx.auth?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden' });
  }
  return next({ ctx });
});

const SETTING_KEY_REG_OPEN = 'scholarship_registration_open';

async function getRegistrationOpen() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_REG_OPEN } });
  return Boolean(row?.value?.open);
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
        include: { profile: true },
      });

      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      };
    }),
  }),

  scholarships: t.router({
    getRegistration: publicProcedure.query(async () => {
      const open = await getRegistrationOpen();
      return { open };
    }),

    setRegistration: adminProcedure.input(setRegistrationSchema).mutation(async ({ input }) => {
      const row = await prisma.appSetting.upsert({
        where: { key: SETTING_KEY_REG_OPEN },
        update: { value: { open: input.open } },
        create: { key: SETTING_KEY_REG_OPEN, value: { open: input.open } },
      });

      return { open: Boolean(row?.value?.open) };
    }),
  }),

  echo: publicProcedure.input(z.object({ message: z.string().min(1) })).mutation(({ input }) => {
    return { message: input.message };
  }),
});

export const createCaller = t.createCallerFactory(appRouter);

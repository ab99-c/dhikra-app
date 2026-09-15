import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import type { AssistantMemoryContext } from "@/shared/assistant";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { answerWithDhikra } from "./assistant";
import { analyzeImageBase64 } from "./_core/imageAnalysis";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  assistant: router({
    chat: publicProcedure
      .input(
        z.object({
          query: z.string().trim().min(1).max(2000),
          memories: z.array(
            z.object({
              id: z.number(),
              title: z.string().nullable(),
              rawText: z.string().nullable(),
              ocrText: z.string().nullable(),
              theme: z.string(),
              capturedAt: z.string(),
              status: z.string(),
              scheduledFor: z.string().nullable(),
            }),
          ).max(12).default([]),
        }),
      )
      .mutation(({ input }) => answerWithDhikra(input.query, input.memories as AssistantMemoryContext[])),
  }),

  content: router({
    analyzeImage: publicProcedure
      .input(
        z.object({
          base64: z.string().min(1),
          mimeType: z.string().optional(),
        }),
      )
      .mutation(({ input }) => analyzeImageBase64(input.base64, input.mimeType)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;

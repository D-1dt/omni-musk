import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const proofSchema = z.object({
  entitySlug: z.string().trim().min(1).max(100),
  entityName: z.string().trim().min(1).max(200),
  planName: z.string().trim().min(1).max(100),
  minimum: z.number().int().nonnegative().max(100_000_000),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  txHash: z.string().trim().max(256).optional().default(""),
  receiptName: z.string().trim().max(255).optional().default(""),
  receiptSize: z.number().int().nonnegative().max(25_000_000).optional().default(0),
});

export const submitInvestmentProof = createServerFn({ method: "POST" })
  .inputValidator(proofSchema)
  .handler(async ({ data }) => {
    // Server-side record of the submission. In production this would write to
    // a database or notify an internal channel; here we at least guarantee
    // the request reached the server before confirming to the user.
    console.log("[proof-submission]", {
      receivedAt: new Date().toISOString(),
      ...data,
    });
    return {
      ok: true as const,
      ticketId: `PRF-${Date.now().toString(36).toUpperCase()}`,
    };
  });

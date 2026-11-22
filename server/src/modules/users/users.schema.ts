import { ThemePreference } from "@prisma/client";
import { z } from "zod";
import { isValidTimeZone } from "../../domain/time";
import { currencySchema } from "../../utils/validation";

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    avatarUrl: z.url("Must be a valid URL").max(500).nullable(),
    currency: currencySchema,
    timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "Unknown timezone"),
    theme: z.enum(ThemePreference),
  })
  .partial()
  .strict();

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

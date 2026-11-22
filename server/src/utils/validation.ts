import { z } from "zod";

export const idParamSchema = z.object({ id: z.uuid("Invalid id") });

/** Trims strings and turns empty strings into null (for optional text fields). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3,5}$/, "Currency must be a 3–5 letter code (e.g. USD, USDT)");

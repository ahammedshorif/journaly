import { Prisma } from "@prisma/client";
import { z } from "zod";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const ZERO = new Prisma.Decimal(0);

/** Converts a nullable Decimal-ish value (Prisma aggregate results) to a Decimal. */
export function toDecimal(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) return ZERO;
  return new Prisma.Decimal(value);
}

const DECIMAL_RE = /^-?\d{1,12}(\.\d{1,8})?$/;

/**
 * Zod schema for money input. Accepts a string or number, returns a normalized string
 * (keeps full precision — never routes through floats on the server).
 */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => DECIMAL_RE.test(v), { message: "Must be a number with up to 8 decimal places" });

export const nonNegativeMoney = moneySchema.refine((v) => !v.startsWith("-"), {
  message: "Must be zero or greater",
});

export const positiveMoney = moneySchema.refine((v) => new Prisma.Decimal(v).gt(0), {
  message: "Must be greater than zero",
});

/** Optional decimal: "", null and undefined all become null. */
export function optionalDecimal<T extends z.ZodType<string>>(schema: T) {
  return z
    .union([z.literal(""), z.null(), schema])
    .optional()
    .transform((v): string | null => (v === "" || v === null || v === undefined ? null : v));
}

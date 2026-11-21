import { z } from "zod";

const DECIMAL_RE = /^\d{1,12}(\.\d{1,8})?$/;

/** Money stays a string end-to-end so we never round through floats. */
export const moneyInput = (opts: { allowZero?: boolean } = {}) =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .regex(DECIMAL_RE, "Enter a valid amount (up to 8 decimals)")
    .refine((v) => opts.allowZero || Number(v) > 0, "Must be greater than zero");

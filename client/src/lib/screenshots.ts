"use client";

import { SCREENSHOT_BUCKET } from "@/lib/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Uploads to Supabase Storage under "<userId>/<uuid>.<ext>" (enforced by storage RLS). Returns the object path. */
export async function uploadScreenshot(file: File): Promise<string> {
  if (!SCREENSHOT_TYPES.includes(file.type)) throw new Error("Only PNG, JPG, WEBP or GIF images");
  if (file.size > MAX_SCREENSHOT_BYTES) throw new Error("Image must be 5 MB or smaller");

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function getScreenshotUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(error?.message ?? "Couldn't load screenshot");
  return data.signedUrl;
}

export async function removeScreenshot(path: string) {
  try {
    await getSupabaseBrowserClient().storage.from(SCREENSHOT_BUCKET).remove([path]);
  } catch {
    // Orphaned files are harmless; don't block the user.
  }
}

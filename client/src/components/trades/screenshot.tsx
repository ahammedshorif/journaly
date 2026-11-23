"use client";

import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/query-keys";
import { getScreenshotUrl, SCREENSHOT_TYPES, uploadScreenshot } from "@/lib/screenshots";
import { cn } from "@/lib/utils";

/** Signed URLs are valid for 1h; cache them for 50 min. */
export function useScreenshotUrl(path: string | null) {
  return useQuery({
    queryKey: queryKeys.screenshot(path ?? ""),
    queryFn: () => getScreenshotUrl(path!),
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
  });
}

export function ScreenshotImage({ path, className }: { path: string; className?: string }) {
  const { data: url, isPending: isLoading, isError } = useScreenshotUrl(path);
  if (isLoading) return <Skeleton className={cn("aspect-video w-full", className)} />;
  if (isError || !url)
    return (
      <div className={cn("grid aspect-video w-full place-items-center rounded-lg border text-sm text-muted-foreground", className)}>
        Screenshot unavailable
      </div>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, no need for next/image */}
      <img src={url} alt="Trade chart screenshot" className={cn("w-full rounded-lg border object-contain", className)} />
    </a>
  );
}

interface UploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
}

/**
 * Uploads straight to Supabase Storage. Replaced/removed files are only deleted after the
 * trade is saved (the parent handles that), so cancelling the form never loses the original.
 */
export function ScreenshotUpload({ value, onChange }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadScreenshot(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      {value ? (
        <div className="relative">
          <ScreenshotImage path={value} className="max-h-72" />
          <div className="absolute right-2 top-2 flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              Replace
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label="Remove screenshot" onClick={() => onChange(null)}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={uploading}
          className={cn(
            "flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-accent",
            dragOver && "border-primary bg-primary/5",
          )}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {uploading ? "Uploading…" : "Drop a chart screenshot or click to upload (max 5 MB)"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={SCREENSHOT_TYPES.join(",")}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

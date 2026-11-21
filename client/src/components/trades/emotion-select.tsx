"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMOTIONS } from "@/lib/constants";
import type { Emotion } from "@/types/api";

const NONE = "__none__";

interface Props {
  id: string;
  value: Emotion | "";
  onChange: (v: Emotion | "") => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
}

export function EmotionSelect({ id, value, onChange, placeholder = "How did you feel?", allowNone = true, noneLabel = "Not set" }: Props) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : (v as Emotion))}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {EMOTIONS.map((e) => (
          <SelectItem key={e.value} value={e.value}>
            {e.emoji} {e.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import { Bell, BellOff } from "lucide-react";
import { REMIND_OPTIONS } from "@/lib/validation";

/** "Vadeden ne kadar önce hatırlat" seçimi. */
export function RemindPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (days: number | null) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-2 flex items-center gap-1.5">
        {value === null ? <BellOff size={12} /> : <Bell size={12} />} Hatırlat
      </p>
      <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
        {REMIND_OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            className="chip"
            aria-pressed={value === o.days}
            onClick={() => onChange(o.days)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

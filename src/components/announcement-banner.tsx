"use client";

import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

export type Announcement = { id: string; title: string; body: string };
const KEY = "gri:duyuru-kapali";

/** Yöneticinin son duyurusu (14 gün): kapatılınca bu cihazda bir daha gösterilmez. */
export function AnnouncementBanner({ announcement }: { announcement: Announcement | null }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (!announcement) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      /* gizli sekme */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
    setHidden(seen === announcement.id);
  }, [announcement]);
  if (!announcement || hidden) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, announcement.id);
    } catch {
      /* gizli sekme */
    }
    setHidden(true);
  };
  return (
    <div className="mx-auto max-w-6xl px-5 pt-3 lg:px-10">
      <div role="status" className="rise flex gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/[0.07] p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <Megaphone size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{announcement.title}</span>
          <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-2">
            {announcement.body}
          </span>
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Duyuruyu kapat"
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

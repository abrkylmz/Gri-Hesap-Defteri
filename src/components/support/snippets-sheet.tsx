"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteSnippet, saveSnippet } from "@/lib/actions/support";
import type { SupportSnippet } from "@/lib/support";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/ui";

/** Ekip: hazır yanıtlar. Birine dokununca yazma alanına eklenir; yenisi eklenebilir, silinebilir. */
export function SnippetsSheet({
  snippets,
  onPick,
  onDone,
}: {
  snippets: SupportSnippet[];
  onPick: (body: string) => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(snippets.length === 0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const res = await saveSnippet({ title, body }).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı." }));
      if (!res.ok) return void toast(res.error, "error");
      toast("Hazır yanıt eklendi");
      setTitle("");
      setBody("");
      setAdding(false);
    });
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteSnippet(id).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı." }));
      toast(res.ok ? "Silindi" : res.error, res.ok ? "default" : "error");
    });

  return (
    <Sheet open={open} onClose={() => setOpen(false)} onExited={onDone} title="Hazır yanıtlar">
      <div className="space-y-3 pb-5">
        {snippets.length === 0 && !adding && (
          <p className="text-sm text-ink-2">Henüz hazır yanıt yok.</p>
        )}
        <ul className="space-y-2">
          {snippets.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-2xl border border-line bg-surface p-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  onPick(s.body);
                  setOpen(false);
                }}
              >
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{s.body}</span>
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(s.id)}
                aria-label={`${s.title}: sil`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-expense/10 hover:text-expense"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        {adding ? (
          <div className="space-y-2 rounded-2xl border border-dashed border-line p-3">
            <input
              className="input"
              placeholder="Başlık · ör. İçe aktarma tarih hatası"
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="input min-h-28 resize-y py-3"
              placeholder="Yanıt metni"
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={pending || !title.trim() || !body.trim()}
                onClick={add}
              >
                {pending && <Spinner />} Kaydet
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost w-full" onClick={() => setAdding(true)}>
            <Plus size={16} /> Yeni hazır yanıt
          </button>
        )}
      </div>
    </Sheet>
  );
}

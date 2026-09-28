"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteCategory, saveCategory } from "@/lib/actions/entries";
import type { CategoryRow, EntryKind } from "@/lib/types";
import { minorToInput, toMinor } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { KindToggle, PageHeader } from "@/components/page-header";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Field, Money, Spinner } from "@/components/ui";

const EMOJIS = [
  "🛒", "🏠", "💡", "🍽️", "☕", "🚌", "🚗", "⛽", "💊", "🏥", "📺", "📱", "👕", "👟", "🎬", "🎮",
  "📚", "🎓", "✈️", "🏖️", "🐾", "👶", "💇", "🏋️", "🎁", "💳", "🧾", "🔧", "🧴", "🍺", "🚬", "📦",
  "💼", "💸", "📈", "🪙", "🏦", "🤝", "💰", "🧑‍💻",
];

type Draft = { id?: string; kind: EntryKind; name: string; emoji: string; budget: string };

export function CategoryManager() {
  const { categories, currency } = useApp();
  const sheet = useSheetState<Draft>();

  return (
    <div className="mx-auto max-w-5xl px-5 lg:px-10">
      <PageHeader eyebrow="Düzen" title="Kategoriler">
        Kayıtlarını grupla, gider kategorilerine aylık bütçe koy. Bütçeler defterde cetvel olarak görünür.
      </PageHeader>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {(["expense", "income"] as const).map((kind) => {
          const list = categories.filter((c) => c.kind === kind);
          return (
            <section key={kind} className="rise" aria-label={kind === "expense" ? "Gider kategorileri" : "Gelir kategorileri"}>
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="flex items-center gap-2 font-serif text-2xl">
                  <span className={cn("size-2.5 rounded-full", kind === "expense" ? "bg-expense" : "bg-income-fill")} />
                  {kind === "expense" ? "Gider" : "Gelir"}
                  <span className="num text-sm text-ink-3">{list.length}</span>
                </h2>
                <button
                  type="button"
                  className="btn btn-ghost h-9 px-3 text-sm"
                  onClick={() => sheet.show({ kind, name: "", emoji: kind === "expense" ? "📦" : "💰", budget: "" })}
                >
                  <Plus size={16} /> Ekle
                </button>
              </div>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        sheet.show({
                          id: c.id,
                          kind: c.kind,
                          name: c.name,
                          emoji: c.emoji,
                          budget: c.monthly_budget ? minorToInput(c.monthly_budget) : "",
                        })
                      }
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-lg">{c.emoji}</span>
                      <span className="flex-1 truncate font-medium">{c.name}</span>
                      {c.monthly_budget ? (
                        <span className="text-right text-xs text-ink-3">
                          bütçe
                          <br />
                          <Money minor={c.monthly_budget} currency={currency} className="text-sm text-ink-2" />
                        </span>
                      ) : null}
                      <ChevronRight size={16} className="text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {sheet.item && (
        <CategoryEditor
          initial={sheet.item}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
          existing={categories}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  initial,
  open,
  onClose,
  onExited,
  existing,
}: {
  initial: Draft;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
  existing: CategoryRow[];
}) {
  const { currency } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial.id);
  const set = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError("Bir isim gir.");
    const clash = existing.some(
      (c) => c.kind === draft.kind && c.id !== draft.id && c.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"),
    );
    if (clash) return setError("Bu isimde bir kategori zaten var.");
    const budget = draft.budget.trim() ? toMinor(draft.budget) : null;
    if (draft.budget.trim() && budget === null) return setError("Bütçe tutarı geçersiz.");

    startTransition(async () => {
      const res = await saveCategory({
        id: draft.id,
        kind: draft.kind,
        name,
        emoji: draft.emoji,
        monthlyBudget: draft.kind === "expense" ? budget : null,
      });
      if (!res.ok) return setError(res.error);
      toast(isEdit ? "Kategori güncellendi" : "Kategori eklendi");
      onClose();
    });
  };

  const remove = () => {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const res = await deleteCategory(id);
      if (!res.ok) return setError(res.error);
      toast("Kategori silindi");
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={isEdit ? "Kategoriyi düzenle" : "Yeni kategori"}
      footer={
        <div className="flex gap-2 pb-1">
          {isEdit && (
            <ConfirmButton onConfirm={remove} disabled={pending} confirmText="Sil">
              Sil
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <form
        className="space-y-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <KindToggle value={draft.kind} onChange={(kind) => set({ kind })} disabled={isEdit} />

        <div className="flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl">
            {draft.emoji}
          </span>
          <input
            className="input"
            placeholder="Kategori adı"
            value={draft.name}
            maxLength={40}
            onChange={(e) => set({ name: e.target.value })}
            autoFocus={!isEdit}
          />
        </div>

        <div>
          <p className="eyebrow mb-2">Simge</p>
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set({ emoji: e })}
                aria-pressed={draft.emoji === e}
                aria-label={`Simge ${e}`}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl text-xl transition-colors",
                  draft.emoji === e ? "bg-ink" : "hover:bg-surface-2",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {draft.kind === "expense" && (
          <Field label="Aylık bütçe (isteğe bağlı)" hint="Boş bırakırsan bütçe takibi yapılmaz.">
            <div className="relative">
              <input
                className="input num pr-12"
                inputMode="decimal"
                placeholder="0"
                value={draft.budget}
                onChange={(e) => set({ budget: e.target.value })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
            </div>
          </Field>
        )}

        {isEdit && (
          <p className="text-xs text-ink-3">
            Kategoriyi silersen içindeki kayıtlar silinmez; “Kategorisiz” olarak kalır.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

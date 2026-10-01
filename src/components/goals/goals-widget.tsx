"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import type { Goal } from "@/lib/goals";
import { GoalSummary } from "./goal-card";

/** Ana ekran: ilk üç finansal hedef ve ilerlemeleri. Hedef yoksa hiç çizilmez. */
export function GoalsWidget({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return null;
  return (
    <section className="card rise px-5 py-4 [animation-delay:100ms]" aria-label="Hedefler">
      <div className="flex items-center justify-between">
        <p className="eyebrow flex items-center gap-1.5">
          <Target size={12} /> Hedefler
        </p>
        <Link href="/hedefler" className="text-xs text-ink-3 hover:text-ink">
          Tümü →
        </Link>
      </div>
      <ul className="mt-3 space-y-3">
        {goals.slice(0, 3).map((g) => (
          <li key={g.id}>
            <Link href="/hedefler" className="block">
              <GoalSummary goal={g} compact />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

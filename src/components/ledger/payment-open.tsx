"use client";

import Link from "next/link";
import type { Payment } from "@/lib/payments";
import { useTxSheet } from "@/components/tx-sheet";

/**
 * Ödeme satırını dokunulabilir yapar: defterdeki kayıt (ör. "tutar bekleniyor") düzenleyicide açılır,
 * henüz yazılmamış düzenli ödeme Düzenli sayfasına götürür.
 */
export function PaymentOpen({
  payment,
  label,
  className,
  children,
}: {
  payment: Payment;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openEdit } = useTxSheet();
  const tx = payment.transaction;
  if (tx) {
    return (
      <button
        type="button"
        onClick={() => openEdit(tx)}
        aria-label={`${label}: düzenle${payment.amount === null ? " (tutarı gir)" : ""}`}
        className={className}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href="/duzenli" aria-label={`${label}: düzenli ödemeyi aç`} className={className}>
      {children}
    </Link>
  );
}

import type { Metadata } from "next";
import { getLoanInstallments, getLoans } from "@/lib/data";
import { LoanView } from "./loan-view";

export const metadata: Metadata = { title: "Kredi" };

export default async function LoanPage() {
  const [loans, installments] = await Promise.all([getLoans(), getLoanInstallments()]);
  return <LoanView loans={loans} installments={installments} />;
}

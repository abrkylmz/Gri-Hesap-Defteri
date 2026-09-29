import type { Metadata } from "next";
import { getLoans } from "@/lib/data";
import { LoanView } from "./loan-view";

export const metadata: Metadata = { title: "Kredi" };

export default async function LoanPage() {
  const loans = await getLoans();
  return <LoanView loans={loans} />;
}

import type { Metadata } from "next";
import { getGoals } from "@/lib/data";
import { GoalsView } from "./goals-view";

export const metadata: Metadata = { title: "Hedefler" };

export default async function GoalsPage() {
  return <GoalsView goals={await getGoals()} />;
}

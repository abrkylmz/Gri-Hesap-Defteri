import type { Metadata } from "next";
import { getIpoData } from "@/lib/data";
import { IpoView } from "./ipo-view";

export const metadata: Metadata = { title: "Halka arz" };

export default async function IpoPage() {
  const data = await getIpoData();
  return <IpoView data={data} />;
}

import type { Metadata } from "next";
import { ImportView } from "./import-view";

export const metadata: Metadata = { title: "Ekstre içe aktar" };

export default function ImportPage() {
  return <ImportView />;
}

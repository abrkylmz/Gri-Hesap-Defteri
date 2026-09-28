import type { Metadata } from "next";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Kategoriler" };

export default function CategoriesPage() {
  // Kategoriler zaten AppProvider'da; ek sorguya gerek yok.
  return <CategoryManager />;
}

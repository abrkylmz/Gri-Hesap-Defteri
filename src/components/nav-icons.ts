import { BookOpen, CalendarClock, Landmark, Repeat, Settings2, Shapes, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import type { NavTabKey } from "@/lib/nav-tabs";

/** Menü sekmelerinin simgeleri (masaüstü yan menü ve mobil alt çubuk ortak). */
export const NAV_ICONS: Record<NavTabKey, LucideIcon> = {
  defter: BookOpen,
  varliklar: Wallet,
  odemeler: CalendarClock,
  hedefler: Target,
  duzenli: Repeat,
  kredi: Landmark,
  "halka-arz": TrendingUp,
  kategoriler: Shapes,
  ayarlar: Settings2,
};

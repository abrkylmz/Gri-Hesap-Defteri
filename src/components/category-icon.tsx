// Uygulamanın tek ikon sistemi (Lucide, çizgi stili). Kategoriler, hesap türleri ve limitler bu
// kayıttaki anahtarlarla gösterilir. Kategorilerin "emoji" sütununda artık ikon anahtarı tutulur;
// eski kayıtlardaki emojiler aşağıdaki tabloyla aynı anlamdaki ikona çevrilir (veri değişmez).

import {
  Baby,
  Banknote,
  Beer,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleDashed,
  Cigarette,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  Handshake,
  HeartPulse,
  Home,
  Hospital,
  Laptop,
  Landmark,
  Lightbulb,
  type LucideIcon,
  Package,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  SprayCan,
  Tag,
  TrendingUp,
  Tv,
  Umbrella,
  Utensils,
  Wallet,
  Wrench,
  Footprints,
} from "lucide-react";

export const ICONS = {
  cart: { icon: ShoppingCart, label: "Market" },
  home: { icon: Home, label: "Ev / kira" },
  bulb: { icon: Lightbulb, label: "Fatura" },
  food: { icon: Utensils, label: "Yeme-içme" },
  coffee: { icon: Coffee, label: "Kahve" },
  bus: { icon: Bus, label: "Ulaşım" },
  car: { icon: Car, label: "Araba" },
  fuel: { icon: Fuel, label: "Yakıt" },
  pill: { icon: Pill, label: "İlaç" },
  hospital: { icon: Hospital, label: "Hastane" },
  health: { icon: HeartPulse, label: "Sağlık" },
  tv: { icon: Tv, label: "Abonelik" },
  phone: { icon: Smartphone, label: "Telefon" },
  shirt: { icon: Shirt, label: "Giyim" },
  shoe: { icon: Footprints, label: "Ayakkabı" },
  bag: { icon: ShoppingBag, label: "Alışveriş" },
  film: { icon: Film, label: "Eğlence" },
  game: { icon: Gamepad2, label: "Oyun" },
  book: { icon: BookOpen, label: "Kitap" },
  school: { icon: GraduationCap, label: "Eğitim" },
  plane: { icon: Plane, label: "Seyahat" },
  holiday: { icon: Umbrella, label: "Tatil" },
  pet: { icon: PawPrint, label: "Evcil hayvan" },
  baby: { icon: Baby, label: "Çocuk" },
  care: { icon: Scissors, label: "Kişisel bakım" },
  gym: { icon: Dumbbell, label: "Spor" },
  gift: { icon: Gift, label: "Hediye" },
  card: { icon: CreditCard, label: "Kart" },
  receipt: { icon: Receipt, label: "Vergi / aidat" },
  tools: { icon: Wrench, label: "Tamir" },
  clean: { icon: SprayCan, label: "Temizlik" },
  drink: { icon: Beer, label: "İçecek" },
  smoke: { icon: Cigarette, label: "Sigara" },
  box: { icon: Package, label: "Diğer" },
  work: { icon: Briefcase, label: "Maaş" },
  cash: { icon: Banknote, label: "Nakit" },
  invest: { icon: TrendingUp, label: "Yatırım" },
  coins: { icon: Coins, label: "Para" },
  bank: { icon: Landmark, label: "Banka / kredi" },
  deal: { icon: Handshake, label: "Anlaşma" },
  income: { icon: HandCoins, label: "Ek gelir" },
  laptop: { icon: Laptop, label: "Serbest iş" },
  piggy: { icon: PiggyBank, label: "Birikim" },
  wallet: { icon: Wallet, label: "Cüzdan" },
  tag: { icon: Tag, label: "Genel" },
  none: { icon: CircleDashed, label: "Kategorisiz" },
} as const satisfies Record<string, { icon: LucideIcon; label: string }>;

export type IconKey = keyof typeof ICONS;

/** Kategori düzenleyicisindeki seçenekler (sırasıyla) */
export const PICKABLE_ICONS = (Object.keys(ICONS) as IconKey[]).filter((k) => k !== "none");

/** Eski emojiler → ikon (önceden kaydedilmiş kategoriler için) */
const EMOJI_TO_ICON: Record<string, IconKey> = {
  "🛒": "cart",
  "🏠": "home",
  "💡": "bulb",
  "🍽️": "food",
  "🍽": "food",
  "☕": "coffee",
  "🚌": "bus",
  "🚗": "car",
  "⛽": "fuel",
  "💊": "pill",
  "🏥": "hospital",
  "📺": "tv",
  "📱": "phone",
  "👕": "shirt",
  "👟": "shoe",
  "🎬": "film",
  "🎮": "game",
  "📚": "book",
  "🎓": "school",
  "✈️": "plane",
  "🏖️": "holiday",
  "🐾": "pet",
  "👶": "baby",
  "💇": "care",
  "🏋️": "gym",
  "🎁": "gift",
  "💳": "card",
  "🧾": "receipt",
  "🔧": "tools",
  "🧴": "clean",
  "🍺": "drink",
  "🚬": "smoke",
  "📦": "box",
  "💼": "work",
  "💸": "income",
  "📈": "invest",
  "🪙": "coins",
  "🏦": "bank",
  "🤝": "deal",
  "💰": "coins",
  "🧑‍💻": "laptop",
  "💵": "cash",
  "🐷": "piggy",
  "👛": "wallet",
  "·": "none",
  "•": "tag",
};

/** Kayıtlı değer (ikon anahtarı ya da eski emoji) → ikon anahtarı */
export function iconKey(value: string | null | undefined): IconKey {
  if (!value) return "none";
  if (value in ICONS) return value as IconKey;
  return EMOJI_TO_ICON[value] ?? EMOJI_TO_ICON[value.replace(/️/g, "")] ?? "tag";
}

/** Tek ikon bileşeni: çizgi stili, tutarlı kalınlık. */
export function AppIcon({
  name,
  size = 18,
  className,
}: {
  /** İkon anahtarı ya da eski emoji */
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[iconKey(name)].icon;
  return <Icon size={size} strokeWidth={1.9} className={className} aria-hidden />;
}

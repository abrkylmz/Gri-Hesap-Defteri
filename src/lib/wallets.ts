// Varlık yerleri (cüzdanlar): istemci ve sunucu ortak tanımlar.

export const WALLET_KINDS = [
  { kind: "bank", label: "Banka hesabı", icon: "bank" },
  { kind: "cash", label: "Nakit", icon: "cash" },
  { kind: "savings", label: "Birikim", icon: "piggy" },
  { kind: "investment", label: "Yatırım hesabı", icon: "invest" },
  { kind: "other", label: "Diğer", icon: "wallet" },
] as const;

export type WalletKind = (typeof WALLET_KINDS)[number]["kind"];
export const WALLET_KIND_CODES = WALLET_KINDS.map((k) => k.kind) as [WalletKind, ...WalletKind[]];
export const walletKind = (kind: WalletKind) => WALLET_KINDS.find((k) => k.kind === kind) ?? WALLET_KINDS.at(-1)!;

export type Wallet = {
  id: string;
  name: string;
  kind: WalletKind;
  /** Kuruş */
  balance: number;
  updated_ms: number;
};

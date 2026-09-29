// Çevrimdışı kayıt kuyruğu (yalnızca tarayıcıda). Bağlantı yokken girilen kayıtlar cihazda
// saklanır; bağlantı gelince sırayla sunucuya gönderilir. Kuyruk kullanıcıya özeldir ve her
// kayıt girildiği defterin sahibini taşır (başka bir deftere yanlışlıkla yazılmasın).

import type { TransactionInput } from "@/lib/validation";

export type OutboxItem = {
  /** Kuyruk anahtarı */
  key: string;
  /** Kaydın girildiği defterin sahibi */
  ledger: string;
  input: TransactionInput;
  queuedAt: number;
};

const EVENT = "gri:outbox";
const storageKey = (user: string) => `gri:outbox:${user}`;

export function readOutbox(user: string): OutboxItem[] {
  try {
    const raw = localStorage.getItem(storageKey(user));
    const items: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? (items as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(user: string, items: OutboxItem[]) {
  try {
    if (items.length) localStorage.setItem(storageKey(user), JSON.stringify(items));
    else localStorage.removeItem(storageKey(user));
  } catch {
    /* depolama kapalı/dolu: kuyruk tutulamaz */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Kaydı kuyruğa ekler. Aynı kaydın (aynı id/newId) önceki bekleyen hali yenisiyle değiştirilir. */
export function enqueue(user: string, ledger: string, input: TransactionInput): boolean {
  const key = input.id ?? input.newId;
  if (!key) return false;
  const items = readOutbox(user).filter((i) => i.key !== key);
  items.push({ key, ledger, input, queuedAt: Date.now() });
  write(user, items);
  return readOutbox(user).some((i) => i.key === key);
}

export function removeFromOutbox(user: string, key: string) {
  write(
    user,
    readOutbox(user).filter((i) => i.key !== key),
  );
}

export function subscribeOutbox(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key?.startsWith("gri:outbox:") && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Sunucu eylemi ağa hiç ulaşamadığında fırlatılan hata mı? (Sunucunun verdiği hata yanıtları değil.) */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return e instanceof TypeError; // fetch: "Failed to fetch" / "Load failed" / "NetworkError…"
}

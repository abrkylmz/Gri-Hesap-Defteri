// Dokunsal geri bildirim (titreşim). Yalnızca tarayıcıda çağrılır.
//
// Android: Vibration API.
// iPhone: Safari Vibration API'yi desteklemez; iOS 18+ ise `<input type="checkbox" switch>`
// anahtarı her değiştiğinde sistem titreşimi üretir. Görünmeyen bir anahtar oluşturup ona
// tıklayarak bu titreşim tetiklenir. Kullanıcının dokunuşu sırasında çağrılmalıdır (bir
// `await`ten sonra iOS titreşimi yutabilir). Eski iOS sürümlerinde sessizce hiçbir şey olmaz.

export type HapticKind = "tap" | "select" | "success" | "warning";

const VIBRATION: Record<HapticKind, number | number[]> = {
  tap: 6,
  select: 10,
  success: [10, 70, 16],
  warning: [22, 90, 22],
};
/** iOS'ta darbe sayısı ve aralığı (ms) */
const IOS_PULSES: Record<HapticKind, number[]> = {
  tap: [0],
  select: [0],
  success: [0, 110],
  warning: [0, 110, 220],
};

export const HAPTICS_KEY = "gri:haptics";

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(HAPTICS_KEY);
    else localStorage.setItem(HAPTICS_KEY, "off");
  } catch {
    /* yok say */
  }
}

let ios: boolean | null = null;
function isIOS() {
  ios ??=
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios;
}

function iosPulse() {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

export function haptic(kind: HapticKind = "tap") {
  if (typeof window === "undefined" || !hapticsEnabled()) return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATION[kind]);
    } else if (isIOS()) {
      for (const at of IOS_PULSES[kind]) {
        if (at === 0) iosPulse();
        else setTimeout(iosPulse, at);
      }
    }
  } catch {
    /* titreşim hiçbir zaman bir işlemi bozmasın */
  }
}

import { Wordmark } from "@/components/ui";

/**
 * Açılış ekranı: sayfa her tam yüklendiğinde (ilk açılış, yenileme; telefonda ve webde) yüklenene
 * kadar (en az ~0,7 sn) görünür ve yumuşakça kaybolur. Uygulama içi geçişlerde ve aşağı çekip
 * yenilemede (router.refresh) görünmez. Görünürlük yalnızca <html data-splash> ile CSS'ten yönetilir (SPLASH_SCRIPT);
 * React ağacına dokunulmaz. JS kapalıysa hiç görünmez.
 */
export const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement;d.dataset.splash="on";var t0=Date.now(),done=false;var hide=function(){if(done)return;done=true;setTimeout(function(){d.dataset.splash="out";setTimeout(function(){d.dataset.splash="off"},450)},Math.max(0,700-(Date.now()-t0)))};if(document.readyState==="complete")hide();else addEventListener("load",hide);setTimeout(hide,4000)}catch(e){}})()`;

const BARS = [0.45, 0.8, 0.3, 1, 0.55, 0.7, 0.35];

export function Splash() {
  return (
    <div aria-hidden className="splash fixed inset-0 z-[100] flex-col items-center justify-center bg-bg">
      <div className="splash-in flex flex-col items-center">
        <Wordmark className="text-5xl lg:text-7xl" />
        <div className="mt-8 flex h-10 items-end gap-[3px] lg:mt-10 lg:h-14 lg:gap-1">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={
                i === 3
                  ? "splash-bar w-[5px] rounded-[2px] lg:w-[7px] bg-income-fill"
                  : "splash-bar w-[5px] rounded-[2px] lg:w-[7px] bg-ink/80"
              }
              style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
        <p className="eyebrow mt-6 text-ink-3 lg:mt-8 lg:text-sm">Hesap Defteri</p>
      </div>
    </div>
  );
}

const MIN_MS = 700;
let shownAt = 0;
let fromApp = false; // yalnızca showSplash ile açılanı kapat (ilk yüklemeyi SPLASH_SCRIPT yönetir)

/** Açılış ekranını uygulama içinden açar (ör. aşağı çekip yenilerken). */
export function showSplash() {
  shownAt = Date.now();
  fromApp = true;
  document.documentElement.dataset.splash = "on";
  setTimeout(hideSplash, 4000); // yenileme takılırsa ekran açık kalmasın
}

/** Açılış ekranını en az ~0,7 sn göründükten sonra yumuşakça kapatır. */
export function hideSplash() {
  const d = document.documentElement;
  if (!fromApp || d.dataset.splash !== "on") return;
  fromApp = false;
  setTimeout(
    () => {
      d.dataset.splash = "out";
      setTimeout(() => (d.dataset.splash = "off"), 450);
    },
    Math.max(0, MIN_MS - (Date.now() - shownAt)),
  );
}

import { Wordmark } from "@/components/ui";

/**
 * Açılış ekranı: oturumdaki ilk açılışta, sayfa yüklenene kadar (en az ~0,8 sn) görünür ve
 * yumuşakça kaybolur. Görünürlük yalnızca <html data-splash> ile CSS'ten yönetilir (SPLASH_SCRIPT);
 * React ağacına dokunulmaz. JS kapalıysa hiç görünmez.
 */
export const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement;if(sessionStorage.getItem("gri:splash"))return;sessionStorage.setItem("gri:splash","1");d.dataset.splash="on";var t0=Date.now(),done=false;var hide=function(){if(done)return;done=true;setTimeout(function(){d.dataset.splash="out";setTimeout(function(){d.dataset.splash="off"},450)},Math.max(0,800-(Date.now()-t0)))};if(document.readyState==="complete")hide();else addEventListener("load",hide);setTimeout(hide,4000)}catch(e){}})()`;

const BARS = [0.45, 0.8, 0.3, 1, 0.55, 0.7, 0.35];

export function Splash() {
  return (
    <div aria-hidden className="splash fixed inset-0 z-[100] flex-col items-center justify-center bg-bg">
      <div className="splash-in flex flex-col items-center">
        <Wordmark className="text-5xl" />
        <div className="mt-8 flex h-10 items-end gap-[3px]">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={i === 3 ? "splash-bar w-[5px] rounded-[2px] bg-income-fill" : "splash-bar w-[5px] rounded-[2px] bg-ink/80"}
              style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
        <p className="eyebrow mt-6 text-ink-3">Hesap Defteri</p>
      </div>
    </div>
  );
}

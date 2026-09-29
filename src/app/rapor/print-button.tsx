"use client";

import { FileDown } from "lucide-react";
import { useEffect } from "react";

/**
 * "PDF olarak kaydet": tarayıcının yazdırma penceresini açar (hedef olarak "PDF olarak kaydet"
 * seçilir; iPhone'da Paylaş → Dosyalara Kaydet). Dosya adı sayfa başlığından gelir.
 */
export function PrintButton({ auto, fileTitle }: { auto: boolean; fileTitle: string }) {
  useEffect(() => {
    document.title = fileTitle;
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400); // yazı tipleri yüklensin
    return () => clearTimeout(t);
  }, [auto, fileTitle]);

  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary h-10 px-4 text-sm">
      <FileDown size={16} /> PDF olarak kaydet
    </button>
  );
}

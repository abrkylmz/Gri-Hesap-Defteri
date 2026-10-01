import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist_Mono, Inter, Instrument_Serif } from "next/font/google";
import { ThemeProvider, THEME_SCRIPT } from "@/components/theme";
import { Splash, SPLASH_SCRIPT } from "@/components/splash";
import "./globals.css";

// Arayüz yazı tipi: Inter (okunaklı, eşit genişlikli rakamlar). Mono yalnızca rapor tablolarında.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-geist-mono" });
const instrument = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: { default: "Gri Hesap Defteri", template: "%s · Gri" },
  description: "Aylık gelir ve giderlerini sade, gri bir defterde tut.",
  applicationName: "Gri Hesap Defteri",
  appleWebApp: { capable: true, title: "Gri", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8e7e3" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Proxy her istekte üretir; Content-Security-Policy yalnızca bu nonce'u taşıyan scripte izin verir.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${instrument.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      </head>
      <body>
        <Splash />
        <ThemeProvider>
          <div className="relative z-10">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}

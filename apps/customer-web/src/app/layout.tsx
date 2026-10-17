import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Cormorant_Garamond } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Exposed to @hayi/ui's theme through --hy-font-sans / --hy-font-display.
const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--hy-font-sans",
});

const display = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--hy-font-display",
});

export const metadata: Metadata = {
  title: "HaYi Shop",
  description: "Đặt trước đồ uống, nhận tại quầy",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f2ea" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-cream text-ink">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { BirimTooltipPortal } from "../v3/design-system/BirimTooltip";

export const metadata: Metadata = {
  title: "BİRİM® Studio | Parametrik Dolap ve Mutfak Platformu",
  description: "Birim Mağaza & Üretim Entegre Parametrik Tasarım ve Konfigürasyon Stüdyosu",
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="h-screen w-screen overflow-hidden bg-[#ECE8E0] text-[#141413] antialiased">
        {children}
        <BirimTooltipPortal />
      </body>
    </html>
  );
}

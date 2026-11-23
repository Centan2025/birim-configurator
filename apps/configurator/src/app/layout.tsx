import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BirimTooltipPortal } from "../v3/design-system/BirimTooltip";

export const metadata: Metadata = {
  title: "BİRİM® Studio | Parametrik Dolap ve Mutfak Platformu",
  description: "Birim Mağaza & Üretim Entegre Parametrik Tasarım ve Konfigürasyon Stüdyosu",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BİRİM Studio",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="h-dvh w-screen overflow-hidden overscroll-none bg-[#ECE8E0] text-[#141413] antialiased">
        {children}
        <BirimTooltipPortal />
      </body>
    </html>
  );
}

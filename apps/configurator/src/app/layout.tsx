import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Birim Configurator | Parametrik Dolap ve Mutfak Platformu",
  description: "Birim Mağaza & Üretim Entegre Parametrik Tasarım ve Konfigürasyon Motoru",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Birim Configurator | Parametrik Dolap ve Mutfak Platformu",
  description: "Birim Mağaza & Üretim Entegre Parametrik Tasarım ve Konfigürasyon Motoru",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%232563EB'/><text x='16' y='22' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='800' font-size='18'>B</text></svg>",
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

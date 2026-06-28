import type { Metadata } from "next";
import { Saira, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const saira = Saira({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-saira",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Champion Manager",
  description: "Tarayıcı tabanlı online futbol menajerlik oyunu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${saira.variable} ${plex.variable}`}>
      <body className="bg-bg-base text-text-cm font-body antialiased">
        {children}
      </body>
    </html>
  );
}

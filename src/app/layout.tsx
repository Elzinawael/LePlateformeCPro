import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConduiPRO | Gestion d'auto-école",
  description: "La plateforme de gestion des auto-écoles au Québec.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
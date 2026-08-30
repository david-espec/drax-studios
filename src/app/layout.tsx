import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallProvider } from "@/install/InstallContext";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drax Studio",
  description: "Grave sua tela e edite vídeos com qualidade profissional, direto do navegador.",
  manifest: withBasePath("/manifest.json"),
};

export const viewport = {
  themeColor: "#0b0c0f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <InstallProvider>
          <AppShell>{children}</AppShell>
        </InstallProvider>
      </body>
    </html>
  );
}

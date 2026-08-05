import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { Header } from "@/components/layout/header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "GTM Validation Tool",
  description: "Lead sourcing and ICP validation dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased min-h-screen bg-neutral-50 text-neutral-900`}>
        <SupabaseProvider>
          <Header />
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
          <Toaster position="bottom-right" />
        </SupabaseProvider>
      </body>
    </html>
  );
}

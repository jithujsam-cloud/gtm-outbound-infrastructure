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
      <body className={`${inter.variable} antialiased`}>
        <SupabaseProvider>
          <Header />
          <main className="flex-1 p-4 md:p-6">{children}</main>
          <Toaster position="bottom-right" />
        </SupabaseProvider>
      </body>
    </html>
  );
}

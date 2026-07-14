import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "@/components/providers";
import { isClerkConfigured } from "@/lib/auth-config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spiritual AI Factory",
  description: "Operate departments for spiritual AI guidance, sales, marketing, social media, and community care.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = <Providers>{children}</Providers>;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {isClerkConfigured() ? <ClerkProvider>{content}</ClerkProvider> : content}
      </body>
    </html>
  );
}

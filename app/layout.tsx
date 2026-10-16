import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/Providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { fredoka, londrina, rubik } from "@/lib/fonts";
import { siteConfig } from "@/config/site";
import Providers from "../components/providers";

export const metadata: Metadata = {
  metadataBase: siteConfig.metadataBase,
  title: {
    default: siteConfig.title,
    template: "%s | HC Admin",
  },
  description: siteConfig.description,
  robots: { index: false, follow: false },
  openGraph: siteConfig.openGraph,
  twitter: siteConfig.twitter,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn("", fredoka.className, rubik.variable, londrina.variable)}
      >
        <Toaster richColors position="bottom-center" />
        <ThemeProvider attribute="class" defaultTheme="dark">
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

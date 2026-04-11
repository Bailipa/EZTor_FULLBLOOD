import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider"
import { NextAuthProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "EZTor",
  description: "A simple and powerful vocabulary memorization tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col">
        <NextAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}

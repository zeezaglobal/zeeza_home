import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Zeeza Global | Software Studio",
  description: "Engineering digital experiences worldwide. Web, Mobile, Cloud & DevOps solutions by Zeeza Global.",
  icons: {
    icon: "/logo_png_black.png",
    shortcut: "/logo_png_black.png",
    apple: "/logo_png_black.png",
  },
  openGraph: {
    title: "Zeeza Global | Software Studio",
    description: "Engineering digital experiences worldwide.",
    siteName: "Zeeza Global",
    type: "website",
    url: "https://zeezaglobal.ca",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travi — Discover the Philippines Your Way",
  description: "Book local Philippine tour packages online. Find the best organizers and trusted transport for your next adventure.",
  keywords: ["Philippines", "Tours", "Travel", "Palawan", "Siargao", "Batanes", "Vacation", "Island Hopping"],
  authors: [{ name: "Travi Team" }],
  openGraph: {
    title: "Travi — Discover the Philippines Your Way",
    description: "Book local Philippine tour packages online. Find the best organizers and trusted transport for your next adventure.",
    url: "https://travi.ph",
    siteName: "Travi",
    images: [
      {
        url: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80",
        width: 1200,
        height: 630,
        alt: "Travi Philippines Tour Marketplace",
      }
    ],
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Travi — Discover the Philippines Your Way",
    description: "Book local Philippine tour packages online. Find the best organizers and trusted transport for your next adventure.",
    images: ["https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${playfairDisplay.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

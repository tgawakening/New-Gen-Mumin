import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Source_Sans_3, Quicksand } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

/** Source Sans 3 - body/nav text */
const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Quicksand - banner/section titles (weights 300–700 available) */
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gen-Mumins - Raising Confident Muslim Leaders",
  description:
    "A long-term immersive program teaching Arabic, Seerah, Qur'anic Tajweed, and Life Skills for young Muslims.",
  authors: [{ name: "Global Awakening" }],
  keywords: [
    "Islamic education",
    "Muslim children",
    "Arabic for kids",
    "Seerah",
    "Tajweed",
    "Islamic leadership",
  ],
  openGraph: {
    title: "Gen-Mumins - Raising Confident Muslim Leaders",
    description:
      "A long-term immersive program teaching Arabic, Seerah, Qur'anic Tajweed, and Life Skills for young Muslims.",
    url: "https://gen-mumins.globalawakening.digital",
    siteName: "Gen-Mumins",
    locale: "en_GB",
    type: "website",
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
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${sourceSans3.variable} ${quicksand.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

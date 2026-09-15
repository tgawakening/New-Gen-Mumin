import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://genmumin.com"),
  title: "Gen-Mumins - Raising Confident Muslim Leaders",
  description:
    "A long-term immersive program teaching Arabic, Seerah, Qur'anic Tajweed, and Life Skills for young Muslims.",
  applicationName: "Gen-Mumins",
  manifest: "/manifest.webmanifest",
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
    images: [
      {
        url: "/images/logo.png",
        width: 512,
        height: 512,
        alt: "Gen-Mumins logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Gen-Mumins - Raising Confident Muslim Leaders",
    description:
      "A long-term immersive program teaching Arabic, Seerah, Qur'anic Tajweed, and Life Skills for young Muslims.",
    images: ["/icons/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: ["/icons/icon-192.png"],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Gen-Mumin",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

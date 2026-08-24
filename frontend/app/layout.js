import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const metadata = {
  title: "Smart Cart | Cross-Platform Web & Mobile Assistant",
  description: "AI-powered voice command shopping assistant with multilingual NLU, wake-word detection, and smart recommendations.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Cart",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${plusJakarta.variable} dark`}>
      <body className="min-h-screen bg-white text-stone-800 font-sans selection:bg-yellow-400 selection:text-white flex flex-col items-center">
        {children}
      </body>
    </html>
  );
}

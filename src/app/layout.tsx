import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simuplug",
  description: "Search the textbooks and get a summary plus interactive simulations generated with OpenUI Lang.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}

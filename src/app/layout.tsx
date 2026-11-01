import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simuplug",
  description: "Search the class 9-10 textbooks and get a summary plus interactive simulations generated with OpenUI Lang.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}

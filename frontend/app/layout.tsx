import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DRRCS",
  description: "Disaster Relief & Resource Coordination System"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}


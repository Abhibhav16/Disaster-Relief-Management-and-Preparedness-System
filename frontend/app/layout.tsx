import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DRRCS - Disaster Response & Relief Coordination System",
  description: "Disaster Response & Relief Coordination System",
  icons: {
    icon: "/favicon.svg",
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}


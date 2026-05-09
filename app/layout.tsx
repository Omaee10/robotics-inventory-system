import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/toastContext";
import { SessionProvider } from "@/lib/sessionContext";

export const metadata: Metadata = {
  title: "Robotics Inventory",
  description: "Team parts and components management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

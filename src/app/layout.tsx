import type { Metadata } from "next";
import "./globals.css";
import GlobalFocusSelect from "@/components/GlobalFocusSelect";

export const metadata: Metadata = {
  title: "MAF Core System",
  description: "Company Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <GlobalFocusSelect />
        {children}
      </body>
    </html>
  );
}

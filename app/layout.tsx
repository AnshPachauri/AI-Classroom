import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Classroom · Fire TV",
  description: "A TV lesson that notices what you misunderstand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

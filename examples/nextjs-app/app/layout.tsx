import type { ReactNode } from "react";
import "stream-md/styles.css";
import "./globals.css";

export const metadata = {
  title: "stream-md · Next.js example",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

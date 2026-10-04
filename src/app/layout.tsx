import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Past Paper Game",
  description: "Practise GCSE Maths exam-style questions and compete with friends.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="text-muted mx-auto w-full max-w-2xl px-4 pb-6 text-center text-sm">
          <Link href="/privacy" className="inline-block min-h-11 content-center underline">
            Privacy
          </Link>
        </footer>
      </body>
    </html>
  );
}

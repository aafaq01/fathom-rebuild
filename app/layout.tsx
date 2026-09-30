import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fathom rebuild",
  description: "AI meeting notes built for the long, crowded call",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-white">F</span>
              <span>Fathom<span className="text-muted font-normal"> rebuild</span></span>
            </Link>
            <form action="/search" className="ml-auto w-full max-w-md">
              <input
                name="q"
                type="search"
                placeholder="Search every transcript…"
                aria-label="Search every transcript"
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
              />
            </form>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

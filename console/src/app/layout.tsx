import type { Metadata } from "next";
import { Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Headings, UI and prose. The `wdth` axis (75-100) is declared because the
// dense table headers and the rail labels use a narrowed width -- it is part of
// why this face was chosen over Geist, not a decoration.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

// Every figure, task id, p-value and token count. No number is set in the sans.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recovery console",
  description:
    "When should an AI coding agent stop retrying and ask a human? 1,604 measured cells from six experimental arms.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}

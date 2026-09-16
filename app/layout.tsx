import type { Metadata } from "next";
import { Shell } from "../components/shell";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://typesafe-ai-playground.vercel.app"),
  openGraph: {
    title: "TypeSafe AI Playground",
    description:
      "Small experiments. Clear decisions. The community playground for Jev.",
    siteName: "TypeSafe AI Playground",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1730,
        height: 909,
        alt: "TypeSafe AI community playground: Small experiments. Clear decisions.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TypeSafe AI Playground",
    description: "The community playground for Jev.",
    images: ["/og.png"],
  },
  title: "TypeSafe · Playground",
  description:
    "A hands-on workspace for Jev classification, conversation routing, and grounded document extraction.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('typesafe-playground-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}`,
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

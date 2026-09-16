import type { Metadata } from "next";
import { Shell } from "../components/shell";
import "./globals.css";
export const metadata: Metadata = {
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

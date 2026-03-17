import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tradealytics – Trading Behavior Analysis",
  description: "AI-powered trading bias detection and coaching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem("theme");
                if (t === "light") {
                  document.documentElement.classList.remove("dark");
                  document.documentElement.classList.add("light");
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

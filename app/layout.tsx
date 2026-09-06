import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI·AX 용어 4컷 만화 생성기",
  description: "교육용 개념 웹툰을 안전하게 제작하는 개인용 도구",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

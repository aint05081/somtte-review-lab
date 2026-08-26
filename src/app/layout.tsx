import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOMTTE Review Lab",
  description: "실제 사용 경험을 실제 소비자 리뷰 문체로 자연스럽게 다듬는 내부 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

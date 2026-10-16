import type { Metadata } from "next";
import { fredoka, rubik } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Hack Canada admin dashboard",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-screen w-full items-center justify-center",
        fredoka.className,
        rubik.variable,
      )}
    >
      {children}
    </div>
  );
}

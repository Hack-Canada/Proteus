import Link from "next/link";
import { getCurrentUser } from "@/auth";
import Image from "next/image";
import ThemeToggle from "../ThemeToggle";
import { Button } from "../ui/button";
import MobileNav from "./MobileNav";

type Props = {};

const Navbar = async ({}: Props) => {
  const user = await getCurrentUser();

  return (
    <header className="fixed z-40 flex h-20 w-full items-center justify-center border-b bg-background/85 backdrop-blur-md dark:border-white/[0.06]">
      <nav className="mx-auto flex h-full w-full flex-1 items-center justify-between px-4 py-2.5 sm:px-8 sm:py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/hack-canada-logo.png"
            alt="Hack Canada Logo"
            width={40}
            height={40}
            className="translate-y-0.5"
          />
          <p className="font-display text-2xl text-foreground xl:text-3xl">
            Hack Canada <span className="text-primary">Admin</span>
          </p>
        </div>

        <div className="flex items-center gap-6">
          <ThemeToggle />

          <div className="hidden lg:block">
            {user ? null : (
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>

          <MobileNav />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;

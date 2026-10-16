import { Fredoka, Londrina_Solid, Rubik } from "next/font/google";

export const fredoka = Fredoka({ subsets: ["latin"] });

export const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
});

export const londrina = Londrina_Solid({
  subsets: ["latin"],
  weight: ["400", "900"],
  variable: "--font-londrina",
});

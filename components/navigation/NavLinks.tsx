import { navLinks, navSections, type NavigationLink } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Clipboard,
  Gavel,
  Target,
  UserCheck,
  CalendarCheck,
  ScanLine,
  Mail,
  Calendar,
  Settings,
  Megaphone,
  Coins,
  ShoppingBag,
  UsersRound,
  ListChecks,
  Trophy,
} from "lucide-react";
import { useSession } from "next-auth/react";

const iconMap = {
  Home: LayoutDashboard,
  Users: Users,
  Applications: Clipboard,
  Statistics: BarChart3,
  Review: Gavel,
  Leaderboards: Trophy,
  Roles: ShieldCheck,
  Logs: ScrollText,
  "Reviewer Stats": UserCheck,
  Challenges: Target,
  RSVPs: CalendarCheck,
  "Check-ins": ScanLine,
  Emails: Mail,
  Banners: Megaphone,
  Schedule: Calendar,
  "Event Config": Settings,
  Points: Coins,
  Shop: ShoppingBag,
  Teams: UsersRound,
  Decisions: ListChecks,
};

function canSee(link: NavigationLink, role: string | undefined, isAdmin: boolean) {
  if (link.roles) return role ? link.roles.includes(role) : false;
  return !link.adminOnly || isAdmin;
}

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/" || !pathname.startsWith(`${href}/`)) return false;
  return !navLinks.some(
    (other) =>
      other.href !== href &&
      other.href.startsWith(`${href}/`) &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
}

interface NavLinksProps {
  isMinimized: boolean;
  onNavigate?: () => void;
}

const NavLinks = ({ isMinimized, onNavigate }: NavLinksProps) => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role;
  const isAdmin = userRole === "admin";

  return (
    <div className="w-full space-y-5 pb-8">
      {navSections.map((section) => {
        const links = section.links.filter((link) =>
          canSee(link, userRole, isAdmin),
        );
        if (links.length === 0) return null;

        return (
          <div key={section.label}>
            {!isMinimized && (
              <p className="mb-1.5 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {links.map((link) => {
                const Icon = iconMap[link.name as keyof typeof iconMap];
                const active = isActive(pathname, link.href);

                return (
                  <li
                    key={link.href}
                    className={cn(
                      "flex rounded-full text-foreground/70 transition-[background-color,color] duration-200",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Link
                      className={cn(
                        "flex w-full items-center px-4 py-2.5",
                        isMinimized ? "justify-center" : "gap-3",
                      )}
                      href={link.href}
                      onClick={onNavigate}
                      title={isMinimized ? link.name : undefined}
                    >
                      {Icon && (
                        <Icon
                          className={cn(
                            "shrink-0",
                            isMinimized ? "size-[22px]" : "size-[18px]",
                          )}
                        />
                      )}
                      {!isMinimized && (
                        <span className="text-nowrap font-medium">
                          {link.name}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default NavLinks;

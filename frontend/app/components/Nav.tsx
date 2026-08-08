"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, IconName } from "./Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/schema", label: "Schema", icon: "sitemap" },
  { href: "/cohorts", label: "Cohorts", icon: "users" },
  { href: "/quality", label: "Quality", icon: "shield" },
  { href: "/evaluation", label: "Evaluation", icon: "chart" },
  { href: "/about", label: "About", icon: "info" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Sections">
      {LINKS.map((l) => {
        const active = path === l.href || (l.href !== "/" && path.startsWith(l.href));
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <Icon name={l.icon} size={13} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

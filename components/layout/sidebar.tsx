"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Role, Region } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠", roles: ["ADMIN", "GUEST_COORDINATOR", "CLEANING", "MAINTENANCE", "FINANCE_VIEWER"] },
  { href: "/properties", label: "Propiedades", icon: "🏡", roles: ["ADMIN"] },
  { href: "/reservations", label: "Reservas", icon: "📅", roles: ["ADMIN", "GUEST_COORDINATOR"] },
  { href: "/messaging", label: "Mensajes AI", icon: "💬", roles: ["ADMIN", "GUEST_COORDINATOR"] },
  { href: "/cleaning", label: "Limpieza", icon: "🧹", roles: ["ADMIN", "CLEANING"] },
  { href: "/maintenance", label: "Mantenimiento", icon: "🔧", roles: ["ADMIN", "MAINTENANCE"] },
  { href: "/finances", label: "Finanzas", icon: "💰", roles: ["ADMIN", "FINANCE_VIEWER"] },
  { href: "/settings", label: "Configuracion", icon: "⚙️", roles: ["ADMIN"] },
];

const REGION_LABELS: Record<string, string> = {
  MEXICO: "Mexico",
  NORWAY: "Noruega",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  GUEST_COORDINATOR: "Coordinador",
  CLEANING: "Limpieza",
  MAINTENANCE: "Mantenimiento",
  FINANCE_VIEWER: "Finanzas",
};

interface SidebarProps {
  userEmail: string;
  userName?: string | null;
  role: Role;
  region?: Region | null;
}

export function Sidebar({ userEmail, userName, role, region }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const initials = (userName ?? userEmail).slice(0, 2).toUpperCase();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-gray-200">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-200">
        <p className="font-semibold text-gray-900">Airbnb Platform</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {region ? REGION_LABELS[region] : "Mexico + Noruega"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {userName ?? userEmail}
            </p>
            <Badge variant="secondary" className="text-xs mt-0.5">
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Cerrar sesion
        </Button>
      </div>
    </aside>
  );
}

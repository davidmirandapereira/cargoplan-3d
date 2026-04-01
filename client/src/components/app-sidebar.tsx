import { Link, useLocation } from "wouter";
import { Calculator, Package, BoxIcon, Layers, LogOut, ChevronUp, FileText, Settings2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";

export function AppSidebar() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: t.nav.planning, icon: Calculator },
    { href: "/products", label: t.nav.products, icon: Package },
    { href: "/boxes", label: t.nav.boxes, icon: BoxIcon },
    { href: "/pallets", label: t.nav.pallets, icon: Layers },
    { href: "/orders", label: t.nav.orders || "Orders", icon: FileText },
    { href: "/settings", label: t.nav.settings || "Definições", icon: Settings2 },
  ];

  const tierLabel = user?.licenseTier === "pro" ? "Pro" : user?.licenseTier === "basic" ? "Basic" : "Trial";
  const tierVariant = user?.licenseTier === "pro" ? "default" : user?.licenseTier === "basic" ? "secondary" : "outline";

  const initials = user
    ? `${(user.firstName || "").charAt(0)}${(user.lastName || "").charAt(0)}`.toUpperCase() || "U"
    : "U";

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-sidebar-primary" data-testid="sidebar-logo">
          <Calculator className="w-5 h-5" />
          <span>{t.app.title}</span>
        </Link>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">{t.app.subtitle}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.sidebar?.navigation || "Navigation"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === href}
                    data-testid={`sidebar-nav-${href === "/" ? "planning" : href.slice(1)}`}
                  >
                    <Link href={href}>
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full"
                  data-testid="sidebar-user-menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || ""} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium truncate">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-sidebar-foreground/60 truncate">
                      {user?.email}
                    </div>
                  </div>
                  <Badge variant={tierVariant as any} className="text-[10px] px-1.5 py-0" data-testid="badge-user-tier">
                    {tierLabel}
                  </Badge>
                  <ChevronUp className="w-4 h-4 ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56" align="start">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t.sidebar?.logout || "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

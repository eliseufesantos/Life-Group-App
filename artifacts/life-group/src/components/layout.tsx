import { Link, useLocation } from "wouter";
import { Home, Users, HeartHandshake, Link as LinkIcon, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetCurrentUser } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();

  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";

  const navItems = [
    { href: "/", icon: Home, label: "Início" },
    { href: "/membros", icon: Users, label: "Membros" },
    { href: "/discipulado", icon: HeartHandshake, label: "Discipulado" },
    ...(isLeaderOrAux ? [{ href: "/convites", icon: LinkIcon, label: "Convites" }] : []),
    { href: "/perfil", icon: User, label: "Perfil" },
    { href: "/configuracoes", icon: Settings, label: "Ajustes" },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col pb-16 md:pb-0 md:pl-64">
      <main className="flex-1 bg-background">{children}</main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-card md:hidden">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="p-6">
          <h1 className="text-xl font-serif font-bold text-primary">Célula</h1>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}

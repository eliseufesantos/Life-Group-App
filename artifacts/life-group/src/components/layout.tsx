import { Link, useLocation } from "wouter";
import { Newspaper, CalendarDays, CircleUserRound, Bell, Church } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetCellConfig, useListNotifications } from "@workspace/api-client-react";

function cellPhotoSrc(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage${photoUrl}`;
}

const TABS = [
  { href: "/", icon: Newspaper, label: "Mural", match: ["/", "/mural"] },
  { href: "/calendario", icon: CalendarDays, label: "Agenda", match: ["/calendario"] },
  {
    href: "/perfil",
    icon: CircleUserRound,
    label: "Perfil",
    match: [
      "/perfil",
      "/membros",
      "/convites",
      "/campanhas",
      "/registros",
      "/relatorios",
      "/celula",
      "/configuracoes",
      "/notificacoes",
    ],
  },
];

const MAIN_ROUTES = ["/", "/mural", "/calendario", "/perfil"];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: cell } = useGetCellConfig();
  const { data: notifications } = useListNotifications();

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const isMainRoute = MAIN_ROUTES.includes(location);
  const photo = cellPhotoSrc(cell?.photoUrl);

  const isTabActive = (tab: (typeof TABS)[number]) =>
    tab.match.some((m) => (m === "/" ? location === "/" : location === m || location.startsWith(`${m}/`)));

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col">
        {isMainRoute && (
          <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-5 pt-[env(safe-area-inset-top)]">
              <Link href="/" className="flex min-w-0 items-center gap-2.5">
                {photo ? (
                  <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Church className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-serif text-base font-extrabold tracking-tight text-foreground">
                    {cell?.name || "Life Group"}
                  </span>
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    Paz Church São Paulo
                  </span>
                </span>
              </Link>
              <Link
                href="/notificacoes"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border bg-card text-foreground shadow-sm transition-colors"
                aria-label="Notificações"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </header>
        )}

        <main className="flex-1 pb-32">{children}</main>
      </div>

      {/* Bottom nav — 3 abas flutuantes */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-lg px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-card-border bg-card/90 p-1.5 shadow-lg backdrop-blur-xl">
            {TABS.map((tab) => {
              const active = isTabActive(tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-label={tab.label}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground"
                  )}
                >
                  <tab.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  <span className={cn(!active && "sr-only")}>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

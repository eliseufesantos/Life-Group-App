import {
  useListNotifications,
  useMarkNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Bell, CalendarDays, ClipboardList, Megaphone, CheckCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";

const TYPE_ICONS = {
  event: CalendarDays,
  task: ClipboardList,
  announcement: Megaphone,
} as const;

export default function Notificacoes() {
  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationsRead();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
        backHref="/"
        action={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-card"
              aria-label="Marcar todas como lidas"
              disabled={markRead.isPending}
              onClick={() =>
                markRead.mutate(undefined, {
                  onSuccess: () =>
                    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
                })
              }
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          ) : undefined
        }
      />

      {(notifications ?? []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
            Nenhuma notificação por enquanto.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(notifications ?? []).map((n) => {
          const Icon = TYPE_ICONS[n.type] ?? Bell;
          return (
            <button
              key={n.id}
              className={cn(
                "w-full text-left rounded-2xl border border-card-border bg-card px-4 py-3 shadow-sm transition-colors active:bg-muted/50",
                !n.read && "border-primary/30 bg-accent/60",
              )}
              onClick={() => {
                if (n.link) setLocation(n.link);
              }}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("h-5 w-5 mt-0.5", !n.read ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground truncate">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(parseISO(n.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

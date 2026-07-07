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
import { Bell, CalendarDays, ClipboardList, Megaphone, CheckCheck, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link, useLocation } from "wouter";

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
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notificações
          </h1>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={markRead.isPending}
            onClick={() =>
              markRead.mutate(undefined, {
                onSuccess: () =>
                  queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
              })
            }
          >
            <CheckCheck className="h-4 w-4 mr-2" /> Marcar todas como lidas
          </Button>
        )}
      </div>

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
                "w-full text-left rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50",
                !n.read && "bg-primary/5 border-primary/30",
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

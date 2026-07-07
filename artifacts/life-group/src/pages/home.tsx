import { useGetMemberStats, useGetNextMeeting, useListCalendarEvents, useListAnnouncements, getListCalendarEventsQueryKey, getListAnnouncementsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, HeartHandshake, Home, CalendarDays, MapPin, Clock, Bell, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";

export default function HomeDashboard() {
  const { data: stats, isLoading: isLoadingStats } = useGetMemberStats();
  const { data: nextMeeting, isLoading: isLoadingNextMeeting } = useGetNextMeeting();

  const today = format(new Date(), "yyyy-MM-dd");
  const next30Days = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const { data: upcomingEvents, isLoading: isLoadingEvents } = useListCalendarEvents(
    { from: today, to: next30Days },
    { query: { queryKey: getListCalendarEventsQueryKey({ from: today, to: next30Days }) } }
  );

  const { data: announcements, isLoading: isLoadingAnnouncements } = useListAnnouncements(
    { query: { queryKey: getListAnnouncementsQueryKey() } }
  );

  if (isLoadingStats || isLoadingNextMeeting || isLoadingEvents || isLoadingAnnouncements) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const upcomingHighlights = upcomingEvents?.filter((e) => !e.canceled).slice(0, 3) || [];
  const recentAnnouncements = announcements?.slice(0, 3) || [];

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Início</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo(a) à nossa célula.</p>
      </div>

      {nextMeeting?.configured && nextMeeting.date && (
        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <CalendarDays className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wide">
                Próximo Encontro
              </span>
              {nextMeeting.overridden && (
                <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-semibold px-2 py-1 rounded-full">
                  Exceção
                </span>
              )}
            </div>
            <h2 className="text-2xl font-serif font-bold text-primary mb-6">
              Reunião da Célula
            </h2>
            <div className="flex flex-wrap gap-6 text-sm font-medium text-foreground/80">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                {format(parseISO(nextMeeting.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </div>
              {nextMeeting.time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {nextMeeting.time}
                </div>
              )}
              {nextMeeting.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {nextMeeting.location}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(!nextMeeting?.configured || !nextMeeting?.date) && (
        <Card className="border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Nenhum encontro agendado</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              Não há próxima reunião confirmada no momento. Fique atento aos avisos.
            </p>
          </CardContent>
        </Card>
      )}
      
      <div>
        <h2 className="text-xl font-serif font-bold text-foreground mb-4">Visão Geral</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Membros</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalMembers || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Convidados</CardTitle>
              <UserPlus className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalGuests || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Conversão: {stats?.conversionRate.toFixed(1) || 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Discipuladores</CardTitle>
              <HeartHandshake className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalDisciplers || 0}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Anfitriões</CardTitle>
              <Home className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalHosts || 0}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif font-bold text-foreground">Destaques do calendário</h2>
            <Link href="/calendario" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingHighlights.length > 0 ? (
              upcomingHighlights.map((event, idx) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-primary/10 rounded-lg p-3 text-center min-w-[4rem]">
                      <div className="text-xs font-bold text-primary uppercase">
                        {format(parseISO(event.date), "MMM", { locale: ptBR })}
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {format(parseISO(event.date), "dd")}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{event.title}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        {event.time && <><Clock className="h-3 w-3" /> {event.time}</>}
                        {event.location && <span className="truncate max-w-[150px] sm:max-w-xs"> &bull; {event.location}</span>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-dashed bg-transparent">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Nenhum evento nos próximos 30 dias.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif font-bold text-foreground">Avisos recentes</h2>
            <Link href="/mural" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
              Mural <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentAnnouncements.length > 0 ? (
              recentAnnouncements.map((announcement) => (
                <Card key={announcement.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-foreground line-clamp-1">{announcement.title}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(parseISO(announcement.createdAt), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {announcement.body}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                      <Bell className="h-3 w-3" />
                      {announcement.authorName || "Célula"}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-dashed bg-transparent">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Nenhum aviso recente.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

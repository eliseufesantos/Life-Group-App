import { useGetCurrentUser, useGetNextMeeting } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Announcements } from "@/components/board/announcements";
import { Polls } from "@/components/board/polls";
import { Tasks } from "@/components/board/tasks";
import { Photos } from "@/components/board/photos";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Board() {
  const { data: user, isLoading } = useGetCurrentUser();
  const { data: nextMeeting, isLoading: isLoadingMeeting } = useGetNextMeeting();

  if (isLoading || isLoadingMeeting) {
    return (
      <div className="space-y-5 px-5 pt-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "";
  const meetingDateRaw =
    nextMeeting?.configured && nextMeeting.date
      ? format(parseISO(nextMeeting.date), "EEEE, d 'de' MMMM", { locale: ptBR })
      : "";
  const meetingDate = meetingDateRaw.charAt(0).toUpperCase() + meetingDateRaw.slice(1);

  return (
    <div className="space-y-6 px-5 pt-2">
      <div>
        <h1 className="font-serif text-2xl font-extrabold tracking-tight text-foreground">
          Olá, {firstName} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tudo da nossa célula em um só lugar.
        </p>
      </div>

      {nextMeeting?.configured && nextMeeting.date ? (
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,hsl(217_91%_52%),hsl(226_80%_42%))] p-6 text-white shadow-lg">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -right-20 h-44 w-44 rounded-full bg-white/[0.07]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                Próximo encontro
              </span>
              {nextMeeting.overridden && (
                <span className="inline-flex rounded-full bg-amber-300/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-950">
                  Ajustado
                </span>
              )}
            </div>
            <h2 className="mt-4 font-serif text-2xl font-extrabold tracking-tight">
              Reunião da Célula
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-white/90">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {meetingDate}
              </span>
              {nextMeeting.time && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {nextMeeting.time}
                </span>
              )}
              {nextMeeting.location && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{nextMeeting.location}</span>
                </span>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-semibold text-foreground">Nenhum encontro agendado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Fique de olho no mural para novidades.
          </p>
        </section>
      )}

      <Tabs defaultValue="avisos" className="w-full">
        <TabsList className="grid h-11 w-full grid-cols-4 bg-muted/80">
          <TabsTrigger value="avisos" className="text-xs sm:text-sm">Avisos</TabsTrigger>
          <TabsTrigger value="enquetes" className="text-xs sm:text-sm">Enquetes</TabsTrigger>
          <TabsTrigger value="tarefas" className="text-xs sm:text-sm">Tarefas</TabsTrigger>
          <TabsTrigger value="fotos" className="text-xs sm:text-sm">Fotos</TabsTrigger>
        </TabsList>
        <div className="mt-5">
          <TabsContent value="avisos" className="m-0 focus-visible:outline-none">
            <Announcements user={user!} />
          </TabsContent>
          <TabsContent value="enquetes" className="m-0 focus-visible:outline-none">
            <Polls user={user!} />
          </TabsContent>
          <TabsContent value="tarefas" className="m-0 focus-visible:outline-none">
            <Tasks user={user!} />
          </TabsContent>
          <TabsContent value="fotos" className="m-0 focus-visible:outline-none">
            <Photos user={user!} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

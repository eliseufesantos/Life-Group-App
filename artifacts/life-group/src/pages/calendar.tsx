import { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useGetCurrentUser, useGetRecurrence, useListCalendarEvents } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const { data: user } = useGetCurrentUser();
  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  const from = format(monthStart, "yyyy-MM-dd");
  const to = format(monthEnd, "yyyy-MM-dd");

  const { data: recurrence, isLoading: isLoadingRecurrence } = useGetRecurrence();
  const { data: events, isLoading: isLoadingEvents } = useListCalendarEvents({ from, to });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => {
    if (!events) return [];
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter(e => e.date === dayStr);
  };

  if (isLoadingEvents || isLoadingRecurrence) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe nossos encontros e eventos.
          </p>
        </div>
        {isLeaderOrAux && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurar Recorrência
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Evento
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-border shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
          <h2 className="text-xl font-bold font-serif capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div key={day} className="px-2 py-3 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(100px,auto)]">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="border-r border-b bg-muted/10 p-2" />
          ))}
          
          {days.map((day, dayIdx) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "border-r border-b p-1 sm:p-2 transition-colors",
                  isToday ? "bg-primary/5" : "hover:bg-muted/30"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-sm font-medium",
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1 mt-1">
                  {dayEvents.map((event, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "text-xs px-1.5 py-1 rounded truncate flex flex-col gap-0.5",
                        event.canceled ? "bg-muted text-muted-foreground line-through opacity-70" :
                        event.type === "meeting" ? "bg-primary/15 text-primary-foreground font-medium text-primary" :
                        "bg-secondary text-secondary-foreground"
                      )}
                    >
                      <span className="truncate">{event.time} {event.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
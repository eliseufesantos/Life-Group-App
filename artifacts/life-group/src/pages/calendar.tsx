import { useState, useMemo, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, Plus, X, Clock, MapPin, AlignLeft, Info, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetCurrentUser, 
  useGetRecurrence, 
  useListCalendarEvents,
  useSetRecurrence,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useOverrideOccurrence,
  useClearOccurrenceOverride,
  getGetRecurrenceQueryKey,
  getListCalendarEventsQueryKey,
  getGetNextMeetingQueryKey,
  CalendarEvent
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const recurrenceSchema = z.object({
  weekday: z.coerce.number().min(0).max(6),
  time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM"),
  location: z.string().optional(),
});

const eventSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Formato YYYY-MM-DD"),
  time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM").optional().or(z.literal("")),
  location: z.string().optional(),
  description: z.string().optional(),
});

const overrideSchema = z.object({
  time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM").optional().or(z.literal("")),
  location: z.string().optional(),
  canceled: z.boolean().default(false),
});

export default function Calendar() {
  const { data: user } = useGetCurrentUser();
  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";
  const isLeader = user?.role === "leader";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  
  // Date ranges
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  const from = viewMode === "month" ? format(monthStart, "yyyy-MM-dd") : format(weekStart, "yyyy-MM-dd");
  const to = viewMode === "month" ? format(monthEnd, "yyyy-MM-dd") : format(weekEnd, "yyyy-MM-dd");

  const { data: recurrence, isLoading: isLoadingRecurrence } = useGetRecurrence();
  const { data: events, isLoading: isLoadingEvents } = useListCalendarEvents(
    { from, to },
    { query: { queryKey: getListCalendarEventsQueryKey({ from, to }) } }
  );

  const nextPeriod = () => setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  const prevPeriod = () => setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));

  const days = eachDayOfInterval({ start: viewMode === "month" ? monthStart : weekStart, end: viewMode === "month" ? monthEnd : weekEnd });

  const getEventsForDay = useCallback((day: Date) => {
    if (!events) return [];
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter(e => e.date === dayStr);
  }, [events]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);

  // Mutations
  const setRecurrence = useSetRecurrence();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const overrideOccurrence = useOverrideOccurrence();
  const clearOverride = useClearOccurrenceOverride();

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: [getListCalendarEventsQueryKey()[0]] }); // Invalidate all calendar events
    queryClient.invalidateQueries({ queryKey: getGetNextMeetingQueryKey() });
  };

  // Forms
  const recurrenceForm = useForm<z.infer<typeof recurrenceSchema>>({
    resolver: zodResolver(recurrenceSchema),
    defaultValues: {
      weekday: 0,
      time: "19:30",
      location: "",
    }
  });

  const eventForm = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      category: "Reunião",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "",
      location: "",
      description: "",
    }
  });

  const overrideForm = useForm<z.infer<typeof overrideSchema>>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      time: "",
      location: "",
      canceled: false,
    }
  });

  const handleOpenRecurrence = () => {
    if (recurrence) {
      recurrenceForm.reset({
        weekday: recurrence.weekday ?? 0,
        time: recurrence.time ?? "19:30",
        location: recurrence.location ?? "",
      });
    }
    setIsRecurrenceOpen(true);
  };

  const handleOpenNewEvent = () => {
    eventForm.reset({
      title: "",
      category: "Confraternização",
      date: format(currentDate, "yyyy-MM-dd"),
      time: "",
      location: "",
      description: "",
    });
    setIsNewEventOpen(true);
  };

  const handleOpenEditEvent = (evt: CalendarEvent) => {
    eventForm.reset({
      title: evt.title,
      category: evt.category || "",
      date: evt.date,
      time: evt.time || "",
      location: evt.location || "",
      description: evt.description || "",
    });
    setIsEditEventOpen(true);
  };

  const handleOpenOverride = (evt: CalendarEvent) => {
    overrideForm.reset({
      time: evt.time || "",
      location: evt.location || "",
      canceled: evt.canceled,
    });
    setIsOverrideOpen(true);
  };

  const onSubmitRecurrence = (data: z.infer<typeof recurrenceSchema>) => {
    setRecurrence.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Recorrência atualizada" });
        setIsRecurrenceOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetRecurrenceQueryKey() });
        invalidateCalendar();
      },
      onError: () => toast({ title: "Erro ao salvar", variant: "destructive" })
    });
  };

  const onSubmitEvent = (data: z.infer<typeof eventSchema>) => {
    const payload = { ...data, time: data.time || undefined };
    if (isEditEventOpen && selectedEvent?.id) {
      updateEvent.mutate({ id: selectedEvent.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Evento atualizado" });
          setIsEditEventOpen(false);
          setIsEventDetailOpen(false);
          invalidateCalendar();
        },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" })
      });
    } else {
      createEvent.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Evento criado" });
          setIsNewEventOpen(false);
          invalidateCalendar();
        },
        onError: () => toast({ title: "Erro ao criar", variant: "destructive" })
      });
    }
  };

  const onSubmitOverride = (data: z.infer<typeof overrideSchema>) => {
    if (!selectedEvent) return;
    const payload = { ...data, time: data.time || undefined };
    overrideOccurrence.mutate({ date: selectedEvent.date, data: payload }, {
      onSuccess: () => {
        toast({ title: "Encontro atualizado" });
        setIsOverrideOpen(false);
        setIsEventDetailOpen(false);
        invalidateCalendar();
      },
      onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" })
    });
  };

  const handleDeleteEvent = () => {
    if (!eventToDelete) return;
    deleteEvent.mutate({ id: eventToDelete }, {
      onSuccess: () => {
        toast({ title: "Evento removido" });
        setEventToDelete(null);
        setIsEventDetailOpen(false);
        invalidateCalendar();
      },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" })
    });
  };

  const handleClearOverride = () => {
    if (!selectedEvent) return;
    clearOverride.mutate({ date: selectedEvent.date }, {
      onSuccess: () => {
        toast({ title: "Ajuste removido" });
        setIsEventDetailOpen(false);
        invalidateCalendar();
      },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" })
    });
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-muted p-1 rounded-md flex items-center mr-2">
            <Button 
              variant={viewMode === "month" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setViewMode("month")}
              className="text-xs h-7 px-3"
            >
              Mês
            </Button>
            <Button 
              variant={viewMode === "week" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setViewMode("week")}
              className="text-xs h-7 px-3"
            >
              Semana
            </Button>
          </div>

          {isLeader && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenRecurrence}>
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurar Recorrência</span>
            </Button>
          )}
          {isLeaderOrAux && (
            <Button size="sm" className="gap-2" onClick={handleOpenNewEvent}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Evento</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden border-border shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
          <h2 className="text-xl font-bold font-serif capitalize">
            {viewMode === "month" 
              ? format(currentDate, "MMMM yyyy", { locale: ptBR })
              : `${format(weekStart, "d MMM", { locale: ptBR })} - ${format(weekEnd, "d MMM", { locale: ptBR })}`}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prevPeriod}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={nextPeriod}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {viewMode === "month" ? (
          <>
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
                      "border-r border-b p-1 sm:p-2 transition-colors min-h-[100px]",
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
                          key={`${event.date}-${idx}`}
                          onClick={() => { setSelectedEvent(event); setIsEventDetailOpen(true); }}
                          className={cn(
                            "text-xs px-1.5 py-1 rounded truncate flex flex-col gap-0.5 cursor-pointer hover:opacity-80 transition-opacity",
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
          </>
        ) : (
          <div className="divide-y">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toString()} className={cn("flex flex-col sm:flex-row p-4 gap-4", isToday && "bg-primary/5")}>
                  <div className="sm:w-24 flex-shrink-0 text-center sm:text-left flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-0">
                    <span className="text-sm text-muted-foreground uppercase font-medium">{format(day, "EEE", { locale: ptBR })}</span>
                    <span className={cn(
                      "text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full",
                      isToday && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="flex-1 space-y-3">
                    {dayEvents.length > 0 ? dayEvents.map((event, idx) => (
                      <Card 
                        key={`${event.date}-${idx}`} 
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-all overflow-hidden border-l-4",
                          event.canceled ? "border-l-muted opacity-60" :
                          event.type === "meeting" ? "border-l-primary" : "border-l-secondary"
                        )}
                        onClick={() => { setSelectedEvent(event); setIsEventDetailOpen(true); }}
                      >
                        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className={cn(event.canceled && "line-through text-muted-foreground")}>
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              {event.title}
                              {event.overridden && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase font-bold">Ajustado</span>}
                            </h4>
                            {event.category && <p className="text-xs text-muted-foreground mt-0.5">{event.category}</p>}
                          </div>
                          <div className="flex flex-col sm:items-end text-sm text-muted-foreground gap-1">
                            {event.time && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {event.time}</span>}
                            {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> <span className="truncate max-w-[200px]">{event.location}</span></span>}
                          </div>
                        </CardContent>
                      </Card>
                    )) : (
                      <div className="h-full min-h-[3rem] flex items-center text-sm text-muted-foreground/50 italic px-4 border border-dashed rounded-lg">
                        Nenhum evento agendado
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Recurrence Dialog */}
      <Dialog open={isRecurrenceOpen} onOpenChange={setIsRecurrenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Recorrência</DialogTitle>
          </DialogHeader>
          <Form {...recurrenceForm}>
            <form onSubmit={recurrenceForm.handleSubmit(onSubmitRecurrence)} className="space-y-4">
              <FormField
                control={recurrenceForm.control}
                name="weekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia da Semana</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Domingo</SelectItem>
                        <SelectItem value="1">Segunda-feira</SelectItem>
                        <SelectItem value="2">Terça-feira</SelectItem>
                        <SelectItem value="3">Quarta-feira</SelectItem>
                        <SelectItem value="4">Quinta-feira</SelectItem>
                        <SelectItem value="5">Sexta-feira</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={recurrenceForm.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={recurrenceForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Endereço da célula" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsRecurrenceOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={setRecurrence.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* New/Edit Event Dialog */}
      <Dialog open={isNewEventOpen || isEditEventOpen} onOpenChange={(open) => {
        if (!open) {
          setIsNewEventOpen(false);
          setIsEditEventOpen(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditEventOpen ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <Form {...eventForm}>
            <form onSubmit={eventForm.handleSubmit(onSubmitEvent)} className="space-y-4">
              <FormField
                control={eventForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Confraternização de Fim de Ano" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={eventForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Social, Treinamento..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={eventForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={eventForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Onde será?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={eventForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalhes do evento..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsNewEventOpen(false); setIsEditEventOpen(false); }}>Cancelar</Button>
                <Button type="submit" disabled={createEvent.isPending || updateEvent.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Encontro Específico</DialogTitle>
            <DialogDescription>
              Modifique apenas a reunião do dia {selectedEvent?.date && format(parseISO(selectedEvent.date), "dd/MM/yyyy")}.
            </DialogDescription>
          </DialogHeader>
          <Form {...overrideForm}>
            <form onSubmit={overrideForm.handleSubmit(onSubmitOverride)} className="space-y-4">
              <FormField
                control={overrideForm.control}
                name="canceled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Cancelar Encontro</FormLabel>
                      <div className="text-sm text-muted-foreground">Não haverá reunião nesta data.</div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {!overrideForm.watch("canceled") && (
                <>
                  <FormField
                    control={overrideForm.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário Alternativo</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={overrideForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local Alternativo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Casa do João" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOverrideOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={overrideOccurrence.isPending}>Aplicar Ajuste</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog open={isEventDetailOpen} onOpenChange={setIsEventDetailOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider",
                    selectedEvent.type === "meeting" ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                  )}>
                    {selectedEvent.category || (selectedEvent.type === "meeting" ? "Reunião" : "Evento")}
                  </span>
                  {selectedEvent.canceled && (
                    <span className="bg-destructive/10 text-destructive px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider">
                      Cancelado
                    </span>
                  )}
                  {selectedEvent.overridden && (
                    <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider">
                      Ajustado
                    </span>
                  )}
                </div>
                <DialogTitle className={cn("text-2xl font-serif", selectedEvent.canceled && "line-through text-muted-foreground")}>
                  {selectedEvent.title}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">{format(parseISO(selectedEvent.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
                    {selectedEvent.time && <div className="text-muted-foreground">às {selectedEvent.time}</div>}
                  </div>
                </div>
                
                {selectedEvent.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>{selectedEvent.location}</div>
                  </div>
                )}
                
                {selectedEvent.description && (
                  <div className="flex items-start gap-3">
                    <AlignLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="whitespace-pre-wrap text-sm">{selectedEvent.description}</div>
                  </div>
                )}
              </div>

              {isLeaderOrAux && (
                <div className="flex flex-col gap-2 pt-4 border-t mt-4">
                  {selectedEvent.type === "free" ? (
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditEvent(selectedEvent)} className="gap-2">
                        <Edit className="h-4 w-4" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setEventToDelete(selectedEvent.id!)} className="gap-2">
                        <Trash2 className="h-4 w-4" /> Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleOpenOverride(selectedEvent)} className="gap-2">
                        <Settings className="h-4 w-4" /> Ajustar Data Específica
                      </Button>
                      {selectedEvent.overridden && (
                        <Button variant="outline" size="sm" onClick={handleClearOverride} className="gap-2 text-amber-600 hover:text-amber-700" disabled={clearOverride.isPending}>
                          <X className="h-4 w-4" /> Restaurar Padrão
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={eventToDelete !== null} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento será permanentemente removido do calendário de todos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteEvent.isPending}>
              Remover Evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

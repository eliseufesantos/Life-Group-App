import { useState, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, Plus, X, MapPin, AlignLeft, Trash2, Edit, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useForm } from "react-hook-form";
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

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function Calendar() {
  const { data: user } = useGetCurrentUser();
  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";
  const isLeader = user?.role === "leader";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const from = format(monthStart, "yyyy-MM-dd");
  const to = format(monthEnd, "yyyy-MM-dd");

  const { data: recurrence, isLoading: isLoadingRecurrence } = useGetRecurrence();
  const { data: events, isLoading: isLoadingEvents } = useListCalendarEvents(
    { from, to },
    { query: { queryKey: getListCalendarEventsQueryKey({ from, to }) } }
  );

  const goToMonth = (date: Date) => {
    setCurrentDate(date);
    setSelectedDay(isSameMonth(date, new Date()) ? new Date() : startOfMonth(date));
  };

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

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
      date: format(selectedDay, "yyyy-MM-dd"),
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
      <div className="space-y-5 px-5 pt-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const selectedDayEvents = getEventsForDay(selectedDay);
  const dayLabelRaw = format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR });
  const dayLabel = dayLabelRaw.charAt(0).toUpperCase() + dayLabelRaw.slice(1);

  return (
    <div className="space-y-6 px-5 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-extrabold tracking-tight text-foreground">Agenda</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Encontros e eventos da célula.</p>
        </div>
        <div className="flex items-center gap-2">
          {isLeader && (
            <Button variant="outline" size="icon" className="rounded-full bg-card" onClick={handleOpenRecurrence} aria-label="Configurar recorrência">
              <CalendarClock className="h-5 w-5" />
            </Button>
          )}
          {isLeaderOrAux && (
            <Button size="icon" className="rounded-full shadow-md" onClick={handleOpenNewEvent} aria-label="Novo evento">
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Grade do mês */}
      <section className="rounded-3xl border border-card-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-lg font-extrabold capitalize tracking-tight">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => goToMonth(subMonths(currentDate, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => goToMonth(new Date())}
              className="flex h-9 items-center rounded-full px-3 text-xs font-bold text-primary transition-colors active:bg-accent"
            >
              Hoje
            </button>
            <button
              onClick={() => goToMonth(addMonths(currentDate, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7">
          {WEEKDAY_LETTERS.map((letter, i) => (
            <div key={i} className="py-1 text-center text-[11px] font-bold text-muted-foreground">
              {letter}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDay);
            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDay(day)}
                className="flex flex-col items-center gap-0.5 py-1"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-md"
                      : isToday
                        ? "bg-accent text-primary"
                        : "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        e.canceled
                          ? "bg-muted-foreground/40"
                          : e.type === "meeting"
                            ? (isSelected ? "bg-primary/60" : "bg-primary")
                            : "bg-sky-400"
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Agenda do dia selecionado */}
      <section>
        <h3 className="mb-2.5 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {dayLabel}
        </h3>
        {selectedDayEvents.length > 0 ? (
          <div className="space-y-2.5">
            {selectedDayEvents.map((event, idx) => (
              <button
                key={`${event.date}-${idx}`}
                onClick={() => { setSelectedEvent(event); setIsEventDetailOpen(true); }}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-card-border bg-card p-4 text-left shadow-sm transition-colors active:bg-muted/50"
              >
                <div className="w-12 shrink-0 text-center">
                  <span className={cn("text-sm font-bold", event.canceled ? "text-muted-foreground line-through" : "text-primary")}>
                    {event.time || "—"}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-10 w-1 shrink-0 rounded-full",
                    event.canceled ? "bg-muted-foreground/30" : event.type === "meeting" ? "bg-primary" : "bg-sky-400"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold text-foreground", event.canceled && "text-muted-foreground line-through")}>
                    {event.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {event.category && <span>{event.category}</span>}
                    {event.location && (
                      <>
                        <span aria-hidden>·</span>
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </>
                    )}
                  </p>
                </div>
                {event.canceled && (
                  <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
                    Cancelado
                  </span>
                )}
                {!event.canceled && event.overridden && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Ajustado
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Nenhum evento neste dia.
          </div>
        )}
      </section>

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
                    "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    selectedEvent.type === "meeting" ? "bg-accent text-primary" : "bg-secondary text-secondary-foreground"
                  )}>
                    {selectedEvent.category || (selectedEvent.type === "meeting" ? "Reunião" : "Evento")}
                  </span>
                  {selectedEvent.canceled && (
                    <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Cancelado
                    </span>
                  )}
                  {selectedEvent.overridden && (
                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Ajustado
                    </span>
                  )}
                </div>
                <DialogTitle className={cn("text-2xl font-serif font-extrabold tracking-tight", selectedEvent.canceled && "line-through text-muted-foreground")}>
                  {selectedEvent.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">
                      {(() => {
                        const d = format(parseISO(selectedEvent.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                        return d.charAt(0).toUpperCase() + d.slice(1);
                      })()}
                    </div>
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
                    <div className="flex gap-2 justify-end flex-wrap">
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

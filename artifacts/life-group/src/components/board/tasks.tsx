import { useState } from "react";
import { useListTasks, useCreateTask, useApproveTask, useCompleteTask, useDeleteTask, getListTasksQueryKey, useListMembers } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, CheckCircle2, Clock, Trash2, Plus, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Tasks({ user }: { user: CurrentUser }) {
  // Use current week's Monday as default
  const [weekStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  
  const { data: tasks, isLoading } = useListTasks({ weekStart });
  const { data: members } = useListMembers({ status: "all" });
  
  const createTask = useCreateTask();
  const approveTask = useApproveTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    // Tasks always belong to a specific person now
    if (!assignedTo || assignedTo === "none") {
      toast({ variant: "destructive", title: "Selecione um responsável" });
      return;
    }
    createTask.mutate(
      { data: { title, weekStart, assignedTo: Number(assignedTo) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ weekStart }) });
          setOpen(false);
          setTitle("");
          setAssignedTo("");
          toast({ title: "Tarefa adicionada" });
        },
      }
    );
  };

  const handleStatusChange = (taskId: number, action: "approve" | "complete" | "delete") => {
    const opts = { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ weekStart }) }) };
    if (action === "approve") approveTask.mutate({ id: taskId }, opts);
    if (action === "complete") completeTask.mutate({ id: taskId }, opts);
    if (action === "delete") deleteTask.mutate({ id: taskId }, opts);
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Tarefas da Semana
          </h2>
          <p className="text-xs text-muted-foreground mt-1 capitalize">
            Semana de {format(parseISO(weekStart), "d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Tarefa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">O que precisa ser feito?</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Levar refrigerante" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quem vai fazer? (Opcional)</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer um" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer um</SelectItem>
                    {members?.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createTask.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!tasks?.length ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <ListTodo className="h-10 w-10 mb-4 opacity-20" />
            <p>Nenhuma tarefa proposta para esta semana.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border bg-card transition-colors",
                task.status === "done" && "opacity-60 bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => task.status === "approved" && handleStatusChange(task.id, "complete")}
                  disabled={task.status !== "approved"}
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    task.status === "done" ? "border-primary bg-primary text-primary-foreground" :
                    task.status === "approved" ? "border-muted-foreground hover:border-primary text-transparent hover:text-primary" :
                    "border-amber-500 bg-amber-50 text-transparent cursor-not-allowed"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <div>
                  <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {task.assigneeName ? `Para: ${task.assigneeName}` : "Aberto a voluntários"} 
                    {task.status === "proposed" && <span className="text-amber-600 ml-2">(Aguardando aprovação)</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isLeaderOrAux && task.status === "proposed" && (
                  <Button variant="outline" size="sm" className="h-8 text-xs border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={() => handleStatusChange(task.id, "approve")}>
                    Aprovar
                  </Button>
                )}
                {(isLeaderOrAux || task.status === "proposed") && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleStatusChange(task.id, "delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
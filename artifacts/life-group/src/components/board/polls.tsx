import { useState } from "react";
import { useListPolls, useCreatePoll, useVotePoll, useClosePoll, useDeletePoll, getListPollsQueryKey } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, BarChart2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Polls({ user }: { user: CurrentUser }) {
  const { data: polls, isLoading } = useListPolls();
  const createPoll = useCreatePoll();
  const votePoll = useVotePoll();
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast({ variant: "destructive", title: "Erro", description: "Adicione pelo menos 2 opções." });
      return;
    }

    createPoll.mutate(
      { data: { question, options: validOptions } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });
          setOpen(false);
          setQuestion("");
          setOptions(["", ""]);
          toast({ title: "Enquete criada" });
        },
      }
    );
  };

  const handleVote = (pollId: number, optionId: number) => {
    votePoll.mutate(
      { id: pollId, data: { optionId } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() }),
      }
    );
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          Enquetes
        </h2>
        {isLeaderOrAux && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova Enquete</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Enquete</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pergunta</label>
                  <Input value={question} onChange={(e) => setQuestion(e.target.value)} required placeholder="Ex: Qual dia é melhor para a confraternização?" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opções</label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={opt} onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }} placeholder={`Opção ${i + 1}`} />
                      {options.length > 2 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ""])}>+ Adicionar opção</Button>
                </div>
                <Button type="submit" className="w-full" disabled={createPoll.isPending}>Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!polls?.length ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 mb-4 opacity-20" />
            <p>Nenhuma enquete ativa.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {polls.map((poll) => (
            <Card key={poll.id} className={cn("flex flex-col", poll.closed && "opacity-80")}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-base leading-tight">{poll.question}</CardTitle>
                  {poll.closed && <span className="text-xs font-semibold bg-muted px-2 py-1 rounded">Encerrada</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Por {poll.authorName} • {poll.totalVotes} votos
                </p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {poll.options.map((opt) => {
                  const percent = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                  const isVoted = poll.myVote === opt.id;
                  
                  return (
                    <button
                      key={opt.id}
                      onClick={() => !poll.closed && handleVote(poll.id, opt.id)}
                      disabled={poll.closed}
                      className={cn(
                        "w-full relative overflow-hidden rounded-md border p-3 text-left transition-all",
                        poll.closed ? "cursor-default" : "hover:border-primary/50 hover:bg-muted/50",
                        isVoted ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background"
                      )}
                    >
                      <div 
                        className={cn("absolute left-0 top-0 bottom-0 opacity-10 transition-all", isVoted ? "bg-primary" : "bg-muted-foreground")} 
                        style={{ width: `${percent}%` }}
                      />
                      <div className="relative z-10 flex justify-between items-center gap-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          {isVoted && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          {opt.text}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {percent}% ({opt.votes})
                        </span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
              {isLeaderOrAux && (
                <CardFooter className="pt-0 border-t mt-auto">
                  <div className="flex gap-2 w-full pt-4">
                    {!poll.closed && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => closePoll.mutate({ id: poll.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() }) })}>
                        Encerrar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deletePoll.mutate({ id: poll.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() }) })}>
                      Excluir
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
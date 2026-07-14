import { useMemo, useState } from "react";
import {
  useListPolls,
  useCreatePoll,
  useVotePoll,
  useClosePoll,
  useDeletePoll,
  getListPollsQueryKey,
} from "@workspace/api-client-react";
import type { CurrentUser, Poll, PollVoter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BarChart2, XCircle, Check, ChevronDown, EyeOff, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AvatarStack, PersonAvatar } from "@/components/board/person-avatar";

function PollCard({
  poll,
  isLeaderOrAux,
  onVote,
  isVoting,
}: {
  poll: Poll;
  isLeaderOrAux: boolean;
  onVote: (pollId: number, optionId: number) => void;
  isVoting: boolean;
}) {
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });

  // One member = one vote, so the union of option voters is the voter list.
  const allVoters = useMemo(() => {
    const seen = new Map<number, PollVoter>();
    for (const opt of poll.options) {
      for (const voter of opt.voters) {
        if (!seen.has(voter.id)) seen.set(voter.id, voter);
      }
    }
    return Array.from(seen.values());
  }, [poll.options]);

  const showVoters = !poll.anonymous && allVoters.length > 0;
  const endsAtDate = poll.endsAt ? parseISO(poll.endsAt) : null;
  const deadline =
    endsAtDate && !poll.closed
      ? isPast(endsAtDate)
        ? "Encerrando..."
        : `Encerra ${formatDistanceToNow(endsAtDate, { locale: ptBR, addSuffix: true })}`
      : null;

  return (
    <Card className={cn("rounded-3xl", poll.closed && "opacity-70")}>
      <CardHeader className="space-y-3 p-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl font-bold leading-snug text-foreground">
            {poll.question}
          </h3>
          {poll.closed && (
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              Encerrada
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Por {poll.authorName ?? "Automático"}</span>
          {poll.anonymous && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-semibold text-foreground/70">
              <EyeOff className="h-3 w-3" />
              Anônima
            </span>
          )}
          {deadline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
              <Timer className="h-3 w-3" />
              {deadline}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-full py-0.5 text-left"
          aria-expanded={expanded}
          aria-label={expanded ? "Ocultar votos" : "Ver quem votou"}
        >
          <span className="flex items-center gap-2">
            {showVoters && <AvatarStack people={allVoters} />}
            <span className="text-xs font-medium text-muted-foreground">
              {poll.totalVotes === 1 ? "1 voto" : `${poll.totalVotes} votos`}
            </span>
          </span>
          {!poll.anonymous && (
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
            />
          )}
        </button>
      </CardHeader>

      <CardContent className="space-y-3 p-6 pt-0">
        {poll.options.map((opt) => {
          const percent = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
          const isVoted = poll.myVote === opt.id;

          return (
            <div key={opt.id}>
              <button
                type="button"
                onClick={() => !poll.closed && onVote(poll.id, opt.id)}
                disabled={poll.closed || isVoting}
                className={cn(
                  "w-full rounded-2xl border p-3.5 text-left transition-all",
                  poll.closed ? "cursor-default" : "hover:border-primary/50 hover:bg-primary/5",
                  isVoted ? "border-primary bg-primary/5" : "border-border bg-background"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                        isVoted
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 text-transparent"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 break-words">{opt.text}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {opt.votes} • {percent}%
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isVoted ? "bg-primary" : "bg-primary/40"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>

              {expanded && !poll.anonymous && opt.voters.length > 0 && (
                <ul className="mt-1.5 space-y-1.5 pl-3">
                  {opt.voters.map((voter) => (
                    <li key={voter.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PersonAvatar name={voter.name} avatarPath={voter.avatarPath} className="h-5 w-5 border" />
                      {voter.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {expanded && poll.anonymous && (
          <p className="text-xs italic text-muted-foreground">
            Enquete anônima — os votos individuais não são revelados.
          </p>
        )}
      </CardContent>

      {isLeaderOrAux && (
        <CardFooter className="border-t p-4">
          <div className="flex w-full gap-2">
            {!poll.closed && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => closePoll.mutate({ id: poll.id }, { onSuccess: invalidate })}
                disabled={closePoll.isPending}
              >
                Encerrar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => deletePoll.mutate({ id: poll.id }, { onSuccess: invalidate })}
              disabled={deletePoll.isPending}
            >
              Excluir
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export function Polls({ user }: { user: CurrentUser }) {
  const { data: polls, isLoading } = useListPolls();
  const createPoll = useCreatePoll();
  const votePoll = useVotePoll();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [endsAt, setEndsAt] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  const resetForm = () => {
    setQuestion("");
    setOptions(["", ""]);
    setEndsAt("");
    setAnonymous(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast({ variant: "destructive", title: "Erro", description: "Adicione pelo menos 2 opções." });
      return;
    }

    createPoll.mutate(
      {
        data: {
          question,
          options: validOptions,
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
          anonymous,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });
          setOpen(false);
          resetForm();
          toast({ title: "Enquete criada" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar a enquete." }),
      }
    );
  };

  const handleVote = (pollId: number, optionId: number) => {
    votePoll.mutate(
      { id: pollId, data: { optionId } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() }),
        onError: () => {
          // Expired polls answer 400 and are removed on the next listing.
          queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });
          toast({ variant: "destructive", title: "Não foi possível votar", description: "A enquete pode ter sido encerrada." });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
          <BarChart2 className="h-5 w-5 text-primary" />
          Enquetes
        </h2>
        {isLeaderOrAux && (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova Enquete</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Nova Enquete</DialogTitle>
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
                        <Button type="button" variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} aria-label={`Remover opção ${i + 1}`}>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ""])}>+ Adicionar opção</Button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="poll-ends-at">Término (opcional)</label>
                  <Input
                    id="poll-ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Após o término, a enquete some do mural de vez.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-2xl border p-3.5">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium" htmlFor="poll-anonymous">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                      Enquete anônima
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ninguém vê quem votou em quê.</p>
                  </div>
                  <Switch id="poll-anonymous" checked={anonymous} onCheckedChange={setAnonymous} />
                </div>
                <Button type="submit" className="w-full" disabled={createPoll.isPending}>
                  {createPoll.isPending ? "Criando..." : "Criar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!polls?.length ? (
        <Card className="rounded-2xl border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <BarChart2 className="mb-4 h-10 w-10 opacity-20" />
            <p>Nenhuma enquete ativa.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              isLeaderOrAux={isLeaderOrAux}
              onVote={handleVote}
              isVoting={votePoll.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

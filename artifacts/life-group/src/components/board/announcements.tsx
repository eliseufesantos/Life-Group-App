import { useState } from "react";
import {
  useListAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  getListAnnouncementsQueryKey,
} from "@workspace/api-client-react";
import type { Announcement, CurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Megaphone, Pencil, HandCoins, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ORIGIN_BADGES: Record<string, { label: string; icon: React.ReactNode }> = {
  birthday: { label: "Aniversário", icon: <span aria-hidden>🎂</span> },
  campaign: { label: "Campanha", icon: <HandCoins className="h-3 w-3" /> },
  registro_pending: { label: "Registro pendente", icon: <ClipboardCheck className="h-3 w-3" /> },
};

function AnnouncementCard({
  aviso,
  isLeaderOrAux,
}: {
  aviso: Announcement;
  isLeaderOrAux: boolean;
}) {
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(aviso.title);
  const [body, setBody] = useState(aviso.body);

  const isAutomatic = aviso.origin !== "manual";
  const canEdit = isLeaderOrAux && !isAutomatic;
  const wasEdited = aviso.updatedAt > aviso.createdAt;
  const originBadge = ORIGIN_BADGES[aviso.origin];

  const startEditing = () => {
    setTitle(aviso.title);
    setBody(aviso.body);
    setEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateAnnouncement.mutate(
      { id: aviso.id, data: { title, body } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
          setEditing(false);
          toast({ title: "Aviso atualizado" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar o aviso." }),
      }
    );
  };

  const handleDelete = () => {
    deleteAnnouncement.mutate(
      { id: aviso.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
          toast({ title: "Aviso apagado" });
        },
      }
    );
  };

  return (
    <Card className="group relative overflow-hidden rounded-2xl">
      <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary/40" />

      {editing ? (
        <form onSubmit={handleSave} className="space-y-3 p-5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            aria-label="Título do aviso"
            className="font-semibold"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            aria-label="Mensagem do aviso"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={updateAnnouncement.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={updateAnnouncement.isPending}>
              {updateAnnouncement.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {originBadge && (
                  <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {originBadge.icon}
                    {originBadge.label}
                  </span>
                )}
                <CardTitle className="font-serif text-lg leading-snug">{aviso.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Por {aviso.authorName ?? "Automático"} •{" "}
                  {format(parseISO(aviso.createdAt), "d 'de' MMM", { locale: ptBR })}
                  {wasEdited && <span className="italic"> • editado</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={startEditing}
                    aria-label="Editar aviso"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {isLeaderOrAux && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleteAnnouncement.isPending}
                    aria-label="Apagar aviso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className={cn("whitespace-pre-wrap text-sm text-foreground/90")}>{aviso.body}</p>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function Announcements({ user }: { user: CurrentUser }) {
  const { data: announcements, isLoading } = useListAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createAnnouncement.mutate(
      { data: { title, body } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
          setOpen(false);
          setTitle("");
          setBody("");
          toast({ title: "Aviso criado", description: "O aviso foi publicado com sucesso." });
        },
        onError: () => toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar o aviso." }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
          <Megaphone className="h-5 w-5 text-primary" />
          Quadro de Avisos
        </h2>
        {isLeaderOrAux && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Aviso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Novo Aviso</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Acampamento de Inverno" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mensagem</label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} placeholder="Detalhes do aviso..." />
                </div>
                <Button type="submit" className="w-full" disabled={createAnnouncement.isPending}>
                  {createAnnouncement.isPending ? "Publicando..." : "Publicar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!announcements?.length ? (
        <Card className="rounded-2xl border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Megaphone className="mb-4 h-10 w-10 opacity-20" />
            <p>Nenhum aviso no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((aviso) => (
            <AnnouncementCard key={aviso.id} aviso={aviso} isLeaderOrAux={isLeaderOrAux} />
          ))}
        </div>
      )}
    </div>
  );
}

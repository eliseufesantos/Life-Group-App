import { useState } from "react";
import { useListAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, getListAnnouncementsQueryKey } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function Announcements({ user }: { user: CurrentUser }) {
  const { data: announcements, isLoading } = useListAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
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

  const handleDelete = (id: number) => {
    deleteAnnouncement.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
          toast({ title: "Aviso apagado" });
        },
      }
    );
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
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
                <DialogTitle>Novo Aviso</DialogTitle>
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
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mb-4 opacity-20" />
            <p>Nenhum aviso no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((aviso) => (
            <Card key={aviso.id} className="relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-lg">{aviso.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Por {aviso.authorName} • {format(parseISO(aviso.createdAt), "d 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>
                  {isLeaderOrAux && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(aviso.id)}
                      disabled={deleteAnnouncement.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{aviso.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
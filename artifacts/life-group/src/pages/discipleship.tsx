import { useListDiscipleships, useCreateDiscipleship, useUpdateDiscipleship, useDeleteDiscipleship, useListMembers, getListDiscipleshipsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function Discipleship() {
  const { data: discipleships, isLoading } = useListDiscipleships();
  const { data: members } = useListMembers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: createDiscipleship, isPending: creating } = useCreateDiscipleship();
  const { mutate: updateDiscipleship } = useUpdateDiscipleship();
  const { mutate: deleteDiscipleship } = useDeleteDiscipleship();

  const [open, setOpen] = useState(false);
  const [disciplerId, setDisciplerId] = useState("");
  const [discipleId, setDiscipleId] = useState("");

  const handleCreate = () => {
    if (!disciplerId || !discipleId) return;
    createDiscipleship(
      { data: { disciplerId: Number(disciplerId), discipleId: Number(discipleId) } },
      {
        onSuccess: () => {
          toast({ title: "Relacionamento criado!" });
          queryClient.invalidateQueries({ queryKey: getListDiscipleshipsQueryKey() });
          setOpen(false);
          setDisciplerId("");
          setDiscipleId("");
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao criar" })
      }
    );
  };

  const handleStatusChange = (id: number, status: any) => {
    updateDiscipleship(
      { id, data: { status } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDiscipleshipsQueryKey() }),
        onError: () => toast({ variant: "destructive", title: "Erro ao atualizar status" })
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este vínculo?")) {
      deleteDiscipleship({ id }, {
        onSuccess: () => {
          toast({ title: "Vínculo removido!" });
          queryClient.invalidateQueries({ queryKey: getListDiscipleshipsQueryKey() });
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao remover" })
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-serif font-bold text-foreground">Discipulado</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2"/> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Discipulado</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Discipulador</label>
                <Select value={disciplerId} onValueChange={setDisciplerId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                  <SelectContent>
                    {members?.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Discípulo</label>
                <Select value={discipleId} onValueChange={setDiscipleId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                  <SelectContent>
                    {members?.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={creating || !disciplerId || !discipleId}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {discipleships?.map(d => (
            <Card key={d.id}>
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Discipulador</p>
                    <Link href={`/membros/${d.disciplerId}`} className="font-medium hover:underline text-primary">{d.disciplerName}</Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={d.status} onValueChange={(v) => handleStatusChange(d.id, v)}>
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Discípulo</p>
                  <Link href={`/membros/${d.discipleId}`} className="font-medium hover:underline text-primary">{d.discipleName}</Link>
                </div>
              </CardContent>
            </Card>
          ))}
          {discipleships?.length === 0 && <p className="text-muted-foreground">Nenhum discipulado registrado.</p>}
        </div>
      )}
    </div>
  );
}

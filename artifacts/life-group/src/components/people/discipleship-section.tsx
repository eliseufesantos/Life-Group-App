import { useState } from "react";
import { Link } from "wouter";
import {
  useListDiscipleships,
  useCreateDiscipleship,
  useUpdateDiscipleship,
  useDeleteDiscipleship,
  useListMembers,
  getListDiscipleshipsQueryKey,
  getGetMemberQueryKey,
  type Discipleship,
  type DiscipleshipInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { HeartHandshake, Plus, Trash2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  completed: "Concluído",
};

const EXTERNAL = "__external__";

/**
 * Vínculos de discipulado de uma pessoa, exibidos no perfil dela.
 * Criação/remoção/status disponíveis apenas para o líder.
 */
export function DiscipleshipSection({
  memberId,
  isLeader,
}: {
  memberId: number;
  isLeader: boolean;
}) {
  const { data: discipleships, isLoading } = useListDiscipleships();
  const { data: members } = useListMembers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: createDiscipleship, isPending: creating } = useCreateDiscipleship();
  const { mutate: updateDiscipleship } = useUpdateDiscipleship();
  const { mutate: deleteDiscipleship } = useDeleteDiscipleship();

  const [adding, setAdding] = useState(false);
  const [direction, setDirection] = useState<"discipler" | "disciple">("discipler");
  const [otherId, setOtherId] = useState("");
  const [externalName, setExternalName] = useState("");

  const asDiscipler = (discipleships ?? []).filter((d) => d.disciplerId === memberId);
  const asDisciple = (discipleships ?? []).filter((d) => d.discipleId === memberId);

  // Candidatos ao outro lado do vínculo: membros do Life Group (sem convidados, sem a própria pessoa)
  const candidates = (members ?? []).filter(
    (m) => m.status !== "guest" && m.id !== memberId,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListDiscipleshipsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId) });
  };

  const resetForm = () => {
    setAdding(false);
    setOtherId("");
    setExternalName("");
    setDirection("discipler");
  };

  const isExternal = otherId === EXTERNAL;
  const canSave = isExternal ? externalName.trim().length > 0 : otherId !== "";

  const handleCreate = () => {
    if (!canSave) return;
    const data: DiscipleshipInput = {};
    if (direction === "discipler") {
      data.disciplerId = memberId;
      if (isExternal) data.externalDiscipleName = externalName.trim();
      else data.discipleId = Number(otherId);
    } else {
      data.discipleId = memberId;
      if (isExternal) data.externalDisciplerName = externalName.trim();
      else data.disciplerId = Number(otherId);
    }
    createDiscipleship(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Vínculo criado!" });
          invalidate();
          resetForm();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao criar vínculo" }),
      },
    );
  };

  const handleStatusChange = (id: number, status: "active" | "paused" | "completed") => {
    updateDiscipleship(
      { id, data: { status } },
      {
        onSuccess: invalidate,
        onError: () => toast({ variant: "destructive", title: "Erro ao atualizar status" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Tem certeza que deseja remover este vínculo?")) return;
    deleteDiscipleship(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Vínculo removido!" });
          invalidate();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao remover" }),
      },
    );
  };

  const renderRelation = (d: Discipleship, side: "disciple" | "discipler") => {
    const otherPersonId = side === "disciple" ? d.discipleId : d.disciplerId;
    const otherPersonName = side === "disciple" ? d.discipleName : d.disciplerName;
    const external = otherPersonId === null;
    return (
      <li key={d.id} className="flex items-center gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          {external ? (
            <p className="truncate text-sm font-semibold text-foreground">{otherPersonName}</p>
          ) : (
            <Link
              href={`/membros/${otherPersonId}`}
              className="block truncate text-sm font-semibold text-primary hover:underline"
            >
              {otherPersonName}
            </Link>
          )}
          {external && (
            <p className="text-[11px] text-muted-foreground">Outro Life Group</p>
          )}
        </div>
        {isLeader ? (
          <>
            <Select
              value={d.status}
              onValueChange={(v) => handleStatusChange(d.id, v as "active" | "paused" | "completed")}
            >
              <SelectTrigger className="h-8 w-[110px] rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive"
              aria-label="Remover vínculo"
              onClick={() => handleDelete(d.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Badge variant={d.status === "active" ? "default" : "secondary"}>
            {STATUS_LABELS[d.status] ?? d.status}
          </Badge>
        )}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <HeartHandshake className="h-5 w-5 text-primary" /> Discipulado
        </CardTitle>
        {isLeader && !adding && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Vínculo
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLeader && adding && (
          <div className="space-y-3 rounded-2xl border border-card-border bg-muted/40 p-4">
            <div className="space-y-2">
              <Label>Nesta relação, a pessoa é</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "discipler" | "disciple")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discipler">Discipulador(a) — discipula alguém</SelectItem>
                  <SelectItem value="disciple">Discípulo(a) — é discipulado(a)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{direction === "discipler" ? "Discípulo(a)" : "Discipulador(a)"}</Label>
              <Select value={otherId} onValueChange={setOtherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={EXTERNAL}>Pessoa de outro Life Group…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isExternal && (
              <div className="space-y-2">
                <Label htmlFor="external-name">Nome da pessoa</Label>
                <Input
                  id="external-name"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  placeholder="Ex.: Ana, do Life Group Central"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={resetForm}>
                Cancelar
              </Button>
              <Button size="sm" className="rounded-full" onClick={handleCreate} disabled={creating || !canSave}>
                {creating ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Discipula
              </p>
              {asDiscipler.length > 0 ? (
                <ul className="divide-y divide-border">
                  {asDiscipler.map((d) => renderRelation(d, "disciple"))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Ninguém no momento.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Discipulado(a) por
              </p>
              {asDisciple.length > 0 ? (
                <ul className="divide-y divide-border">
                  {asDisciple.map((d) => renderRelation(d, "discipler"))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Ninguém no momento.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

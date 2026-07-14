import { useState } from "react";
import { useListInvites, useCreateInvite, getListInvitesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Plus, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export default function Invites() {
  const { data: invites, isLoading } = useListInvites();
  const { mutate: createInvite, isPending } = useCreateInvite();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createInvite({ data: { name: trimmed } }, {
      onSuccess: () => {
        toast({ title: "Convite gerado!" });
        queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
        setName("");
      },
      onError: () => toast({ variant: "destructive", title: "Erro ao gerar convite" })
    });
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/entrar/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title="Convites"
        subtitle="Convide novas pessoas para o Life Group"
      />

      {/* Novo convite: nome obrigatório antes de gerar */}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <div className="relative flex-1">
          <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome de quem será convidado"
            aria-label="Nome de quem será convidado"
            className="h-11 rounded-full border-card-border bg-card pl-10 shadow-sm"
          />
        </div>
        <Button type="submit" className="h-11 shrink-0" disabled={isPending || !name.trim()}>
          <Plus className="h-4 w-4" /> Gerar
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : (
        <div className="grid gap-3">
          {invites?.map(invite => {
            const expired = new Date(invite.expiresAt) < new Date();
            const valid = !invite.used && !expired;
            return (
              <Card key={invite.id} className={valid ? "border-primary/20" : "opacity-60"}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-lg font-extrabold tracking-tight text-foreground">
                      {invite.name}
                    </h3>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{invite.code}</p>
                    <p className="text-xs text-muted-foreground mt-1">Expira em: {new Date(invite.expiresAt).toLocaleString('pt-BR')}</p>
                    <div className="mt-2">
                      <Badge variant={valid ? "default" : "secondary"}>
                        {invite.used ? "Usado" : expired ? "Expirado" : "Válido"}
                      </Badge>
                    </div>
                  </div>
                  {valid && (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => copyToClipboard(invite.code)}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar Link
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {invites?.length === 0 && <p className="text-muted-foreground">Nenhum convite gerado.</p>}
        </div>
      )}
    </div>
  );
}

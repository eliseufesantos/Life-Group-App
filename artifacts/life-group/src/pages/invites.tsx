import { useListInvites, useCreateInvite, getListInvitesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export default function Invites() {
  const { data: invites, isLoading } = useListInvites();
  const { mutate: createInvite, isPending } = useCreateInvite();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = () => {
    // Placeholder name until the invite UI gains a name field (future task)
    createInvite({ data: { name: "Convidado" } }, {
      onSuccess: () => {
        toast({ title: "Convite gerado!" });
        queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
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
        subtitle="Convide novas pessoas para a célula"
        action={
          <Button onClick={handleCreate} disabled={isPending}>
            <Plus className="h-4 w-4" /> Gerar
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : (
        <div className="grid gap-3">
          {invites?.map(invite => {
            const expired = new Date(invite.expiresAt) < new Date();
            const valid = !invite.used && !expired;
            return (
              <Card key={invite.id} className={valid ? "border-primary/20" : "opacity-60"}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold">{invite.code}</p>
                    <p className="text-xs text-muted-foreground mt-1">Expira em: {new Date(invite.expiresAt).toLocaleString('pt-BR')}</p>
                    <div className="mt-2">
                      <Badge variant={valid ? "default" : "secondary"}>
                        {invite.used ? "Usado" : expired ? "Expirado" : "Válido"}
                      </Badge>
                    </div>
                  </div>
                  {valid && (
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(invite.code)}>
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

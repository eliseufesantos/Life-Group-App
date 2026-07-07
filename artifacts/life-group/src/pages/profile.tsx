import { useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full max-w-2xl mx-auto" /></div>;
  if (!user) return null;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-foreground">Meu Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Função</p>
            <Badge className="capitalize">{user.role}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Categorias</p>
            <div className="flex gap-2 flex-wrap">
              {user.categories.map(c => <Badge key={c} variant="outline" className="capitalize">{c}</Badge>)}
              {user.categories.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma categoria</span>}
            </div>
          </div>
          {user.formationTrack && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Trilha de Formação</p>
              <p className="text-sm">{user.formationTrack}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

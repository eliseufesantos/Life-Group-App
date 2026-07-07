import { useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { HandCoins, FileBarChart, Home, ChevronRight, ShieldCheck } from "lucide-react";

export default function Profile() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full max-w-2xl mx-auto" /></div>;
  if (!user) return null;

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  const adminLinks = [
    { href: "/campanhas", icon: HandCoins, label: "Campanhas", description: "Campanhas de doações e arrecadações" },
    { href: "/relatorios", icon: FileBarChart, label: "Relatórios", description: "Relatórios mensais e sob demanda" },
    { href: "/celula", icon: Home, label: "Célula", description: "Nome, foto e reunião semanal" },
  ];

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas da Célula</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/campanhas" className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <HandCoins className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Ver campanhas</p>
                <p className="text-xs text-muted-foreground">Doações e arrecadações em andamento</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {isLeaderOrAux && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Administração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Moon, Sun } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { mutate: logout, isPending } = useLogout();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        setLocation("/login");
      },
      onError: () => toast({ variant: "destructive", title: "Erro ao sair" })
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-foreground">Configurações</h1>

      <Card>
        <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Tema do Aplicativo</p>
          <div className="flex gap-2">
            <Button variant={theme === "light" ? "default" : "outline"} size="icon" onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4" />
            </Button>
            <Button variant={theme === "dark" ? "default" : "outline"} size="icon" onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sessão</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" className="w-full sm:w-auto" onClick={handleLogout} disabled={isPending}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

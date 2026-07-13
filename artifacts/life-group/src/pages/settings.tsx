import { useEffect, useState } from "react";
import {
  useLogout,
  useGetPushPublicKey,
  useSubscribePush,
  useUnsubscribePush,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, Moon, Sun, Bell, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import {
  isPushSupported,
  isIos,
  isStandalone,
  getExistingSubscription,
  subscribeToPush,
  subscriptionToPayload,
} from "@/lib/push-client";

function PushNotificationsCard() {
  const { toast } = useToast();
  const { data: keyData } = useGetPushPublicKey();
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isPushSupported();
  const iosNotInstalled = isIos() && !isStandalone();

  useEffect(() => {
    if (!supported) return;
    getExistingSubscription().then((sub) => setEnabled(!!sub));
  }, [supported]);

  const handleToggle = async (checked: boolean) => {
    if (!supported || busy) return;
    setBusy(true);
    try {
      if (checked) {
        if (!keyData?.publicKey) {
          toast({ variant: "destructive", title: "Chave de notificação indisponível" });
          return;
        }
        const sub = await subscribeToPush(keyData.publicKey);
        await subscribePush.mutateAsync({ data: subscriptionToPayload(sub) });
        setEnabled(true);
        toast({ title: "Notificações ativadas" });
      } else {
        const sub = await getExistingSubscription();
        if (sub) {
          await unsubscribePush.mutateAsync({ data: { endpoint: sub.endpoint } });
          await sub.unsubscribe();
        }
        setEnabled(false);
        toast({ title: "Notificações desativadas" });
      }
    } catch (err) {
      if (err instanceof Error && err.message === "permission-denied") {
        toast({
          variant: "destructive",
          title: "Permissão negada",
          description: "Autorize as notificações nas configurações do navegador.",
        });
      } else {
        toast({ variant: "destructive", title: "Erro ao alterar notificações" });
      }
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="push-toggle" className="text-sm">Notificações push</Label>
            <p className="text-xs text-muted-foreground">
              Receba avisos de novos eventos, tarefas e comunicados.
            </p>
          </div>
          <Switch
            id="push-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={!supported || busy}
          />
        </div>
        {!supported && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {iosNotInstalled
                ? "No iPhone/iPad, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) para ativar as notificações."
                : "Este navegador não suporta notificações push."}
            </span>
          </div>
        )}
        {supported && iosNotInstalled && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No iPhone/iPad, as notificações só funcionam com o app instalado na Tela de Início
              (Compartilhar → Adicionar à Tela de Início).
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
    <div className="px-5 pt-6 space-y-5">
      <PageHeader title="Ajustes" subtitle="Tema, notificações e sessão" />

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

      <PushNotificationsCard />

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

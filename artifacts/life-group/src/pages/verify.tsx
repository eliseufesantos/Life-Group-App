import { useEffect } from "react";
import { useLocation } from "wouter";
import { useVerifyMagicLink } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

export default function Verify() {
  const [, setLocation] = useLocation();
  const { mutate: verify } = useVerifyMagicLink();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      toast({ variant: "destructive", title: "Erro", description: "Token não encontrado." });
      setLocation("/login");
      return;
    }

    verify(
      { data: { token } },
      {
        onSuccess: () => {
          toast({ title: "Bem-vindo!" });
          setLocation("/");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro", description: "Link inválido ou expirado." });
          setLocation("/login");
        },
      }
    );
  }, [verify, setLocation, toast]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center space-y-4">
      <Spinner className="h-8 w-8 text-primary" />
      <p className="text-muted-foreground">Verificando seu acesso...</p>
    </div>
  );
}

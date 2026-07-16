import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRequestMagicLink } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Church } from "lucide-react";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

export default function Login() {
  const [devLink, setDevLink] = useState<string | null>(null);
  const { mutate: requestLink, isPending } = useRequestMagicLink();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  function onSubmit(data: z.infer<typeof schema>) {
    requestLink(
      { data: { email: data.email } },
      {
        onSuccess: (res) => {
          toast({ title: "Link enviado", description: "Verifique sua caixa de entrada." });
          if (res.devLink) {
            setDevLink(res.devLink);
          }
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível enviar o link." });
        },
      }
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(217_91%_52%),hsl(226_80%_42%))] text-white shadow-lg">
            <Church className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-serif text-3xl font-extrabold tracking-tight text-foreground">
            Bem-vindo(a)!
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tudo do seu Life Group em um só lugar.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-card-border bg-card p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" inputMode="email" autoComplete="email" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                {isPending ? "Enviando..." : "Receber link de acesso"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Enviaremos um link mágico para o seu e-mail. Sem senha.
          </p>
        </div>

        {devLink && (
          <div className="mt-4 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium">Link de desenvolvimento:</p>
            <a href={devLink} className="text-sm text-primary underline break-all">
              {devLink}
            </a>
          </div>
        )}

        <p className="mt-8 text-center text-xs font-medium text-muted-foreground">
          Life Group · Paz Church São Paulo
        </p>
      </div>
    </div>
  );
}

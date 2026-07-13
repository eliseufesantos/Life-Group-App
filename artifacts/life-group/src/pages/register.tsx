import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterWithInvite, useValidateInvite, getValidateInviteQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useParams } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { Church } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
});

export default function Register() {
  const { code } = useParams();
  const { data: validation, isLoading: validating } = useValidateInvite(code!, {
    query: { enabled: !!code, queryKey: getValidateInviteQueryKey(code!) }
  });
  
  const [devLink, setDevLink] = useState<string | null>(null);
  const { mutate: register, isPending } = useRegisterWithInvite();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  if (validating) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
  if (!validation?.valid) return <div className="p-8 text-center text-destructive">Convite inválido ou expirado.</div>;

  function onSubmit(data: z.infer<typeof schema>) {
    register(
      { data: { code: code!, name: data.name, email: data.email, phone: data.phone } },
      {
        onSuccess: (res) => {
          toast({ title: "Registrado com sucesso", description: "Verifique seu e-mail para o link de acesso." });
          if (res.devLink) {
            setDevLink(res.devLink);
          }
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível registrar." });
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
            Junte-se à célula
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Preencha seus dados para participar.</p>
        </div>

        <div className="mt-8 rounded-3xl border border-card-border bg-card p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending ? "Enviando..." : "Registrar"}
            </Button>
          </form>
        </Form>
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

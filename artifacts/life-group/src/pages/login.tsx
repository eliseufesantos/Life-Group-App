import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRequestMagicLink } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-serif font-bold text-primary">Bem-vindo à Célula</h1>
          <p className="text-muted-foreground">Insira seu e-mail para acessar.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Enviando..." : "Entrar"}
            </Button>
          </form>
        </Form>

        {devLink && (
          <div className="mt-4 rounded-md bg-muted p-4">
            <p className="text-sm font-medium">Link de desenvolvimento:</p>
            <a href={devLink} className="text-sm text-primary underline break-all">
              {devLink}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

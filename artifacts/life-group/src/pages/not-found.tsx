import { Link } from "wouter";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-serif text-2xl font-extrabold tracking-tight text-foreground">
        Página não encontrada
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        O endereço que você acessou não existe.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md"
      >
        Voltar ao mural
      </Link>
    </div>
  );
}

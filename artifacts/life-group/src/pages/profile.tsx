import { useGetCurrentUser, useGetMemberStats, getGetMemberStatsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Users,
  HeartHandshake,
  Link as LinkIcon,
  HandCoins,
  FileBarChart,
  Home,
  Bell,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { ROLE_LABELS, CATEGORY_LABELS } from "@/lib/labels";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function MenuGroup({ title, items }: { title: string; items: { href: string; icon: LucideIcon; label: string; description: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-muted/60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Profile() {
  const { data: user, isLoading } = useGetCurrentUser();
  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";
  const { data: stats } = useGetMemberStats({
    query: { enabled: isLeaderOrAux, queryKey: getGetMemberStatsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-5 px-5 pt-2">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (!user) return null;

  const communityItems = [
    { href: "/membros", icon: Users, label: "Pessoas", description: "Membros e convidados da célula" },
    { href: "/discipulado", icon: HeartHandshake, label: "Discipulado", description: "Vínculos de discipulado" },
    ...(isLeaderOrAux
      ? [{ href: "/convites", icon: LinkIcon, label: "Convites", description: "Convide novas pessoas" }]
      : []),
  ];

  const cellItems = [
    { href: "/campanhas", icon: HandCoins, label: "Campanhas", description: "Doações e arrecadações" },
    ...(isLeaderOrAux
      ? [
          { href: "/relatorios", icon: FileBarChart, label: "Relatórios", description: "Relatórios mensais e sob demanda" },
          { href: "/celula", icon: Home, label: "Célula", description: "Nome, foto e reunião semanal" },
        ]
      : []),
  ];

  const accountItems = [
    { href: "/notificacoes", icon: Bell, label: "Notificações", description: "Avisos e atualizações" },
    { href: "/configuracoes", icon: Settings, label: "Ajustes", description: "Tema, notificações push e sessão" },
  ];

  const statCards = [
    { label: "Membros", value: stats?.totalMembers },
    { label: "Convidados", value: stats?.totalGuests },
    { label: "Discipuladores", value: stats?.totalDisciplers },
    { label: "Anfitriões", value: stats?.totalHosts },
  ];

  return (
    <div className="space-y-6 px-5 pt-2">
      {/* Cartão de identidade */}
      <section className="rounded-3xl border border-card-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(217_91%_52%),hsl(226_80%_42%))] font-serif text-2xl font-extrabold text-white shadow-md">
          {initials(user.name)}
        </div>
        <h1 className="mt-3 font-serif text-xl font-extrabold tracking-tight text-foreground">
          {user.name}
        </h1>
        {user.email && <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          {user.categories.map((c) => (
            <span key={c} className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              {CATEGORY_LABELS[c] ?? c}
            </span>
          ))}
        </div>
        {user.formationTrack && (
          <p className="mt-3 text-xs text-muted-foreground">
            Trilha de formação: <span className="font-semibold text-foreground">{user.formationTrack}</span>
          </p>
        )}
      </section>

      {/* Visão geral (líderes e auxiliares) */}
      {isLeaderOrAux && stats && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Visão geral
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-2xl border border-card-border bg-card p-4 shadow-sm">
                <p className="font-serif text-2xl font-extrabold text-foreground">{s.value ?? 0}</p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <MenuGroup title="Comunidade" items={communityItems} />
      <MenuGroup title="Célula" items={cellItems} />
      <MenuGroup title="Conta" items={accountItems} />
    </div>
  );
}

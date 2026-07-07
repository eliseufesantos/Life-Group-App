import type { Usuario, RelacaoDiscipulado } from "@workspace/db";

export function toCurrentUser(u: Usuario) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role ?? "member") as "leader" | "auxiliary" | "member",
    categories: (u.categories ?? []) as ("host" | "discipler" | "disciple")[],
    formationTrack: u.formationTrack,
  };
}

export function toMember(u: Usuario, privileged: boolean) {
  return {
    id: u.id,
    name: u.name,
    email: privileged ? u.email : null,
    phone: privileged ? u.phone : null,
    status: (u.status === "guest" ? "guest" : "member") as "member" | "guest",
    role: (u.role ?? null) as "leader" | "auxiliary" | "member" | null,
    categories: (u.categories ?? []) as ("host" | "discipler" | "disciple")[],
    formationTrack: privileged ? u.formationTrack : null,
    invitedBy: u.invitedBy,
    joinedAt: u.joinedAt ? u.joinedAt.toISOString() : null,
    active: u.active,
  };
}

export interface DiscipleshipRow {
  rel: RelacaoDiscipulado;
  disciplerName: string;
  discipleName: string;
}

export function toDiscipleship(row: DiscipleshipRow) {
  return {
    id: row.rel.id,
    disciplerId: row.rel.disciplerId,
    disciplerName: row.disciplerName,
    discipleId: row.rel.discipleId,
    discipleName: row.discipleName,
    startDate: row.rel.startDate,
    status: row.rel.status as "active" | "paused" | "completed",
    notes: row.rel.notes,
  };
}

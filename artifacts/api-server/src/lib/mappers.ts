import type { Usuario, RelacaoDiscipulado } from "@workspace/db";

export function toCurrentUser(u: Usuario) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role ?? "member") as "leader" | "auxiliary" | "member",
    categories: (u.categories ?? []) as ("host" | "discipler" | "disciple")[],
    formationTrack: u.formationTrack,
    birthDate: u.birthDate,
    avatarPath: u.avatarPath,
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
    birthDate: u.birthDate,
    avatarPath: u.avatarPath,
    invitedBy: u.invitedBy,
    joinedAt: u.joinedAt ? u.joinedAt.toISOString() : null,
    active: u.active,
  };
}

export interface DiscipleshipRow {
  rel: RelacaoDiscipulado;
  /** Resolved internal member names (empty map entries fall back to external names) */
  names: Map<number, string>;
}

export function toDiscipleship(row: DiscipleshipRow) {
  const { rel, names } = row;
  const disciplerName =
    rel.disciplerId !== null
      ? (names.get(rel.disciplerId) ?? "")
      : (rel.externalDisciplerName ?? "");
  const discipleName =
    rel.discipleId !== null
      ? (names.get(rel.discipleId) ?? "")
      : (rel.externalDiscipleName ?? "");
  return {
    id: rel.id,
    disciplerId: rel.disciplerId,
    disciplerName,
    externalDisciplerName: rel.externalDisciplerName,
    discipleId: rel.discipleId,
    discipleName,
    externalDiscipleName: rel.externalDiscipleName,
    startDate: rel.startDate,
    status: rel.status as "active" | "paused" | "completed",
    notes: rel.notes,
  };
}

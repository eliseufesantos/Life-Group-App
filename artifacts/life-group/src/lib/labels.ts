export const ROLE_LABELS: Record<string, string> = {
  leader: "Líder",
  auxiliary: "Auxiliar",
  member: "Membro",
  guest: "Convidado",
};

export const CATEGORY_LABELS: Record<string, string> = {
  host: "Anfitrião",
  discipler: "Discipulador",
  disciple: "Discípulo",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

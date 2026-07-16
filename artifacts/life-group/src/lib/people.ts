/** Helpers compartilhados para pessoas (avatar, iniciais, idade). */

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Resolve um objectPath do storage (ou URL absoluta) para uma URL de imagem. */
export function avatarSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage${path}`;
}

/** Idade em anos a partir de uma data YYYY-MM-DD; null se inválida. */
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Data de nascimento formatada em pt-BR (ex.: "12 de maio"). */
export function formatBirthday(birthDate: string): string {
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return birthDate;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

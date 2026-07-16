import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Resolves a stored object path (e.g. a member's avatarPath) to its serving
 * URL — same convention the API uses for uploaded photos (`/api/storage` +
 * objectPath).
 */
export function objectPathUrl(path: string | null | undefined): string | undefined {
  return path ? `/api/storage${path}` : undefined;
}

/** "Maria Souza dos Santos" -> "MS" (first + last name initials). */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

interface PersonAvatarProps {
  name: string;
  avatarPath?: string | null;
  className?: string;
}

/** Circular avatar: photo when available, otherwise initials on a soft blue disc. */
export function PersonAvatar({ name, avatarPath, className }: PersonAvatarProps) {
  const url = objectPathUrl(avatarPath);
  return (
    <Avatar className={cn("h-7 w-7 border-2 border-card", className)}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
        {nameInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

interface AvatarStackProps {
  people: { id: number; name: string; avatarPath: string | null }[];
  max?: number;
  className?: string;
}

/** Overlapping row of avatars, capped at `max`, with a "+N" bubble for the rest. */
export function AvatarStack({ people, max = 5, className }: AvatarStackProps) {
  if (people.length === 0) return null;
  const visible = people.slice(0, max);
  const extra = people.length - visible.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((p) => (
        <PersonAvatar key={p.id} name={p.name} avatarPath={p.avatarPath} />
      ))}
      {extra > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground">
          +{extra}
        </div>
      )}
    </div>
  );
}

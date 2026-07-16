import { cn } from "@/lib/utils";
import { avatarSrc, initials } from "@/lib/people";

/**
 * Avatar de pessoa: foto quando `avatarPath` existe, senão círculo com iniciais.
 * Dimensione via className (ex.: "h-10 w-10 text-sm").
 */
export function MemberAvatar({
  name,
  avatarPath,
  className,
}: {
  name: string;
  avatarPath?: string | null;
  className?: string;
}) {
  const src = avatarSrc(avatarPath);
  if (src) {
    return (
      <img
        src={src}
        alt={`Foto de ${name}`}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(217_91%_52%),hsl(226_80%_42%))] font-serif font-extrabold text-white",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// First + last word initial for a multi-word name (e.g. "Jane Middle Doe" -> "JD"), first two
// characters for a single word (e.g. "Cher" -> "CH") - the common convention avatars elsewhere
// (Slack, Gmail, ...) already use.
export const resolveAvatarInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
};

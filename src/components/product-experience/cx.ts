type ClassValue = string | undefined | false | null;

export function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

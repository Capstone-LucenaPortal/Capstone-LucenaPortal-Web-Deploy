/**
 * Structurally typed rather than Pick<YellowCardApplication, …> so the preview
 * builders can pass a narrower row without constructing a whole application.
 */
export interface NameParts {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
}

export function getFullName(parts: NameParts): string {
  return [parts.first_name, parts.middle_name, parts.last_name, parts.suffix]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
}

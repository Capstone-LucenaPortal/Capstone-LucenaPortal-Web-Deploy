/**
 * The content of the home page's City Programs section, `/programs` and the
 * category pages under it. Everything a resident reads there is edited here.
 *
 * All of it is placeholder until the real descriptions and photos arrive. To
 * fill an image in, put the file under `public/programs/<slug>/` and set `src`
 * to its path (`/programs/wedding/ceremony.jpg`) and `alt` to what it shows. A
 * category with more than one program gets more entries in `programs`.
 */

export interface ProgramImageContent {
  /** Path under `public/`. `null` renders a placeholder box in its place. */
  src: string | null;
  alt: string;
}

export interface Program {
  name: string;
  description: string;
  howToApply: string;
  /** The first image shows large; the rest sit in a row beneath the description. */
  images: ProgramImageContent[];
}

export interface ProgramCategory {
  /** Name shown on tiles, the sidebar and the breadcrumb. */
  name: string;
  /** The category's address: `/programs/<slug>`. Changing one breaks existing links. */
  slug: string;
  /** The one line under the name on the home page. */
  summary: string;
  programs: Program[];
}

function placeholderCategory(name: string, slug: string): ProgramCategory {
  return {
    name,
    slug,
    summary: 'One-line placeholder',
    programs: [
      {
        name: 'PROGRAM NAME PLACEHOLDER',
        description: 'Placeholder program description. Replace with real content.',
        howToApply: 'Placeholder instructions for how residents can apply.',
        images: [
          { src: null, alt: `${name} program image placeholder` },
          { src: null, alt: `${name} program image placeholder 2` },
          { src: null, alt: `${name} program image placeholder 3` },
        ],
      },
    ],
  };
}

export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  placeholderCategory('Agricultural', 'agricultural'),
  placeholderCategory('Animal', 'animal'),
  placeholderCategory('Baptism', 'baptism'),
  placeholderCategory('Business', 'business'),
  placeholderCategory('Education', 'education'),
  placeholderCategory('Housing', 'housing'),
  placeholderCategory('Senior Citizen', 'senior-citizen'),
  placeholderCategory('Wedding', 'wedding'),
  placeholderCategory('Wellness', 'wellness'),
];

/** The home page summary and the `/programs` introduction. */
export const PROGRAMS_OVERVIEW = {
  homeImage: { src: null, alt: 'Featured program image placeholder' } as ProgramImageContent,
  homeSummary: "Placeholder summary of the city's programs and who they serve. Replace with real content.",
  bannerImage: { src: null, alt: 'City programs banner image placeholder' } as ProgramImageContent,
  introduction: "Placeholder introduction to Lucena's city programs. Replace with real content.",
};

export function getProgramCategory(slug: string): ProgramCategory | undefined {
  return PROGRAM_CATEGORIES.find((category) => category.slug === slug);
}

/**
 * The content of the home page's City Programs section, `/programs` and the
 * category pages under it. Everything a resident reads there is edited here.
 *
 * The descriptions are real; the photos, and the Animal category, are still
 * placeholders. To fill an image in, put the file under `public/programs/<slug>/`
 * and set `src` to its path (`/programs/wedding/ceremony.jpg`) and `alt` to what
 * it shows. A category with more than one program gets more entries in `programs`.
 */

export interface ProgramImageContent {
  /** Path under `public/`. `null` renders a placeholder box in its place. */
  src: string | null;
  alt: string;
}

export interface ProgramSteps {
  /** The box's heading, such as "How to Apply" or "How to Claim". */
  heading: string;
  text: string;
}

export interface Program {
  name: string;
  description: string;
  /** What a resident does to take part. Left out, the program shows no steps box. */
  steps?: ProgramSteps;
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

/** Three placeholder boxes until the program's photos arrive. */
function placeholderImages(programName: string): ProgramImageContent[] {
  return [
    { src: null, alt: `${programName} photo placeholder` },
    { src: null, alt: `${programName} photo placeholder 2` },
    { src: null, alt: `${programName} photo placeholder 3` },
  ];
}

function program(name: string, description: string, steps?: ProgramSteps): Program {
  return { name, description, ...(steps && { steps }), images: placeholderImages(name) };
}

export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  {
    name: 'Agricultural',
    slug: 'agricultural',
    summary: 'Farm inputs, insurance and health services for local farmers.',
    programs: [
      program(
        'Distribution of Agricultural Inputs and Boomerang Balik Kalinga',
        "Two services in one for Lucena's local farmers, held at the Lucena Convention Center. The program is led by the Mayor, with the City Agriculture Office and the City Health Office. Beneficiaries receive insurance cheques, seeds, YAKAP Gamot and free cancer screening, and can register for PhilHealth and YAKAP on site. It is part of the city's continuing support for farmers' livelihoods, health and welfare.",
      ),
    ],
  },
  {
    name: 'Animal',
    slug: 'animal',
    summary: 'One-line placeholder',
    programs: [
      {
        name: 'PROGRAM NAME PLACEHOLDER',
        description: 'Placeholder program description. Replace with real content.',
        steps: { heading: 'How to Apply', text: 'Placeholder instructions for how residents can apply.' },
        images: [
          { src: null, alt: 'Animal program image placeholder' },
          { src: null, alt: 'Animal program image placeholder 2' },
          { src: null, alt: 'Animal program image placeholder 3' },
        ],
      },
    ],
  },
  {
    name: 'Baptism',
    slug: 'baptism',
    summary: 'Free community baptism for the children of Lucena.',
    programs: [
      program(
        'Binyagang Bayan (Free Community Baptism)',
        'A free baptism service for the children of Lucena, held at chapels in the barangays, often during local feast days such as that of San Isidro Labrador.',
      ),
    ],
  },
  {
    name: 'Business',
    slug: 'business',
    summary: 'Orientation on starting and running a business in the city.',
    programs: [
      program(
        'Business One-Stop Shop (BOSS) Orientation Program',
        'The Office of the City Mayor, through the Business One-Stop Shop, holds orientation sessions for new and existing business owners at the Lucena City Government Complex. The sessions help entrepreneurs understand the requirements and procedures for starting and running a business in the city.',
      ),
    ],
  },
  {
    name: 'Education',
    slug: 'education',
    summary: 'Support for city scholars through to graduation.',
    programs: [
      program(
        'Iskolar ng Bayan',
        'The city supports its scholars through to graduation, with a ceremony where they receive their diplomas.',
      ),
    ],
  },
  {
    name: 'Housing',
    slug: 'housing',
    summary: 'Homes for informal settlers and low-salaried city employees.',
    programs: [
      program(
        'Don Victor Ville Housing Project',
        'A housing project that provides homes for informal settlers and low-salaried city employees. Beneficiaries receive their certificate and a symbolic key to their new home at a turn-over ceremony.',
      ),
    ],
  },
  {
    name: 'Senior Citizen',
    slug: 'senior-citizen',
    summary: 'Free movies, birthday payouts and a centenarian incentive.',
    programs: [
      program(
        'Libreng Sine para kina Lolo at Lola',
        'Free movie screenings for senior citizens of Lucena City only. Seniors can claim their Libreng Sine Booklet at the Office of the Senior Citizen Affairs (OSCA).',
        {
          heading: 'How to Claim',
          text: "Senior citizen: bring your Senior Citizen ID.\nRepresentative: bring a written authorization from the senior, the senior's ID, and the representative's own ID.",
        },
      ),
      program(
        'Birthday Payout for Senior Citizens (Door-to-Door)',
        "A birthday payout for Lucena's senior citizens, delivered to their homes by city staff. Seniors who find it hard to travel don't have to go to the office to claim it.",
      ),
      program(
        'Cash Incentive for Centenarians',
        "Lucena City recognizes its centenarian residents with a ₱100,000 cash incentive. The City Social Welfare and Development Office (CSWDO) delivers it in person to the centenarian's home.",
      ),
    ],
  },
  {
    name: 'Wedding',
    slug: 'wedding',
    summary: 'Free mass wedding ceremonies for Lucena residents.',
    programs: [
      program(
        'Kasalang Bayan (Free Community Mass Wedding)',
        'A regular city service that offers free mass wedding ceremonies to Lucena residents, held in community venues such as the St. Jude Thaddeus Shrine in Barangay Cotta.',
      ),
    ],
  },
  {
    name: 'Wellness',
    slug: 'wellness',
    summary: 'Car-free Sundays on Quezon Avenue for exercise and fun.',
    programs: [
      program(
        'Car-Free, Care-Free Sunday',
        'A recurring Sunday event that closes Quezon Avenue to vehicles so people can exercise and have fun. Activities include Zumba, Tabata, jogging, walking, jump rope, boxing and pickleball open play, plus special attractions such as RC Crawl-Free Sunday and the Trick-or-Treat Fitness Trail.',
      ),
    ],
  },
];

/** The home page summary and the `/programs` introduction. */
export const PROGRAMS_OVERVIEW = {
  homeImage: { src: null, alt: 'Featured program image placeholder' } as ProgramImageContent,
  homeSummary:
    "Lucena City runs programs for its farmers, senior citizens, scholars, families and business owners, from free weddings and baptisms to housing and Car-Free Sundays.",
  bannerImage: { src: null, alt: 'City programs banner image placeholder' } as ProgramImageContent,
  introduction:
    "Lucena City runs programs that support its residents' livelihoods, health and welfare: inputs and health services for farmers, free movies and payouts for senior citizens, free community weddings and baptisms, business orientation, scholarships, housing, and Car-Free Sundays on Quezon Avenue.",
};

export function getProgramCategory(slug: string): ProgramCategory | undefined {
  return PROGRAM_CATEGORIES.find((category) => category.slug === slug);
}

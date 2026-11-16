/**
 * The content of the home page's City Programs section, `/programs` and the
 * category pages under it. Everything a resident reads there is edited here.
 *
 * Photos live under `public/programs/<slug>/`. A program's first photo shows
 * large; the rest sit in a row beneath its description. A category with more
 * than one program gets more entries in `programs`.
 */

export interface ProgramImageContent {
  /** Path under `public/`. `null` renders a placeholder box in its place. */
  src: string | null;
  alt: string;
  /**
   * `cover` (the default) fills the frame and crops what overflows, which suits
   * photos. `contain` shows the whole image, for posters and news graphics
   * whose text a crop would cut off.
   */
  fit?: 'cover' | 'contain';
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

/** A photo from `public/programs/<slug>/<file>`. */
function photo(slug: string, file: string, alt: string): ProgramImageContent {
  return { src: `/programs/${slug}/${file}`, alt };
}

/** A poster or news graphic: shown whole so its text isn't cropped. */
function graphic(slug: string, file: string, alt: string): ProgramImageContent {
  return { ...photo(slug, file, alt), fit: 'contain' };
}

export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  {
    name: 'Agricultural',
    slug: 'agricultural',
    summary: 'Farm inputs, insurance and health services for local farmers.',
    programs: [
      {
        name: 'Distribution of Agricultural Inputs and Boomerang Balik Kalinga',
        description:
          "Two services in one for Lucena's local farmers, held at the Lucena Convention Center. The program is led by the Mayor, with the City Agriculture Office and the City Health Office. Beneficiaries receive insurance cheques, seeds, YAKAP Gamot and free cancer screening, and can register for PhilHealth and YAKAP on site. It is part of the city's continuing support for farmers' livelihoods, health and welfare.",
        images: [
          photo('agricultural', 'a2.jpg', 'Farmers and city officials pose with a ceremonial cheque at the Lucena Convention Center'),
          photo('agricultural', 'a.jpg', 'Welcome banner for the distribution of agricultural inputs to the farmers of Lucena City, beside sacks of supplies'),
          photo('agricultural', 'a3.jpg', 'A city official shakes hands with a farmer'),
          photo('agricultural', 'a4.jpg', 'Farmers gathered in the stands of the convention center'),
          photo('agricultural', 'a6.jpg', 'Sacks of fertilizer and farm supplies ready for distribution'),
          graphic('agricultural', 'a8.jpg', 'News graphic: farmers and fisherfolk in Lucena receive machinery and support from the city'),
        ],
      },
    ],
  },
  {
    name: 'Baptism',
    slug: 'baptism',
    summary: 'Free community baptism for the children of Lucena.',
    programs: [
      {
        name: 'Binyagang Bayan (Free Community Baptism)',
        description:
          'A free baptism service for the children of Lucena, held at chapels in the barangays, often during local feast days such as that of San Isidro Labrador.',
        images: [
          photo('baptism', 'bp2.jpg', 'A priest baptizes a child as the parents and godparents look on'),
          photo('baptism', 'b3.jpg', 'Families fill a barangay chapel for the community baptism'),
          photo('baptism', 'bp.jpg', 'Parents hold their baby during the baptism'),
          photo('baptism', 'bp1.jpg', 'Godparents light baptismal candles'),
          photo('baptism', 'bp5.jpg', 'Binyagang Bayan banner at San Isidro Labrador Chapel, Barangay Ibabang Talim'),
          graphic('baptism', 'b1.jpg', 'News graphic: Binyagang Bayan for the families of Barangay Ibabang Talim'),
          graphic('baptism', 'bp3.jpg', 'News graphic: more than 70 children baptized together at the Binyagang Bayan'),
        ],
      },
    ],
  },
  {
    name: 'Business',
    slug: 'business',
    summary: 'Orientation on starting and running a business in the city.',
    programs: [
      {
        name: 'Business One-Stop Shop (BOSS) Orientation Program',
        description:
          'The Office of the City Mayor, through the Business One-Stop Shop, holds orientation sessions for new and existing business owners at the Lucena City Government Complex. The sessions help entrepreneurs understand the requirements and procedures for starting and running a business in the city.',
        images: [
          photo('business', 'b.jpg', 'A speaker addresses the BOSS Orientation Program for business owners'),
          photo('business', 'b2.jpg', 'Business owners seated for the orientation session'),
          photo('business', 'b4.jpg', 'A business owner receives an envelope of business documents'),
          photo('business', 'b5.jpg', 'City staff and participants pose for a group photo after the orientation'),
          graphic('business', 'b7.jpg', 'News graphic: 130 new business owners in Lucena attend the business orientation'),
        ],
      },
    ],
  },
  {
    name: 'Education',
    slug: 'education',
    summary: 'Support for city scholars through to graduation.',
    programs: [
      {
        name: 'Iskolar ng Bayan',
        description:
          'The city supports its scholars through to graduation, with a ceremony where they receive their diplomas.',
        images: [
          photo('education', '34.jpg', 'Iskolar ng Bayan graduates in caps and gowns hold up their diplomas'),
          photo('education', 'e2.jpg', 'A graduate receives her diploma on stage'),
          photo('education', 'e5.jpg', 'A scholar holds her diploma at the commencement exercises'),
          graphic('education', 'e.jpg', 'News graphic: 867 Iskolar ng Bayan receive their diplomas'),
        ],
      },
    ],
  },
  {
    name: 'Housing',
    slug: 'housing',
    summary: 'Homes for informal settlers and low-salaried city employees.',
    programs: [
      {
        name: 'Don Victor Ville Housing Project',
        description:
          'A housing project that provides homes for informal settlers and low-salaried city employees. Beneficiaries receive their certificate and a symbolic key to their new home at a turn-over ceremony.',
        images: [
          photo('housing', 'h2.jpg', 'Rows of red-roofed houses at Don Victor Ville'),
          photo('housing', 'h.jpg', 'The Don Victor Ville entrance arch and welcome sign'),
          photo('housing', 'h3.jpg', 'A beneficiary holds the symbolic key and certificate at the turn-over ceremony'),
        ],
      },
    ],
  },
  {
    name: 'Senior Citizen',
    slug: 'senior-citizen',
    summary: 'Free movies, birthday payouts and a centenarian incentive.',
    programs: [
      {
        name: 'Libreng Sine para kina Lolo at Lola',
        description:
          'Free movie screenings for senior citizens of Lucena City only. Seniors can claim their Libreng Sine Booklet at the Office of the Senior Citizen Affairs (OSCA).',
        steps: {
          heading: 'How to Claim',
          text: "Senior citizen: bring your Senior Citizen ID.\nRepresentative: bring a written authorization from the senior, the senior's ID, and the representative's own ID.",
        },
        images: [
          graphic('senior-citizen', 'c1.jpg', 'Libreng Sine para kina Lolo at Lola poster: free movies resume for the senior citizens of Lucena'),
          graphic('senior-citizen', 's6.jpg', 'Libreng Sine for Senior Citizens poster'),
        ],
      },
      {
        name: 'Birthday Payout for Senior Citizens (Door-to-Door)',
        description:
          "A birthday payout for Lucena's senior citizens, delivered to their homes by city staff. Seniors who find it hard to travel don't have to go to the office to claim it.",
        images: [
          graphic('senior-citizen', 'c6.jpg', 'News graphic: city staff deliver a birthday payout to a senior citizen at her home'),
        ],
      },
      {
        name: 'Cash Incentive for Centenarians',
        description:
          "Lucena City recognizes its centenarian residents with a ₱100,000 cash incentive. The City Social Welfare and Development Office (CSWDO) delivers it in person to the centenarian's home.",
        images: [
          graphic('senior-citizen', 's4.jpg', 'CSWDO staff deliver the ₱100,000 cash incentive to a centenarian in Barangay Mayao Kanluran'),
        ],
      },
    ],
  },
  {
    name: 'Wedding',
    slug: 'wedding',
    summary: 'Free mass wedding ceremonies for Lucena residents.',
    programs: [
      {
        name: 'Kasalang Bayan (Free Community Mass Wedding)',
        description:
          'A regular city service that offers free mass wedding ceremonies to Lucena residents, held in community venues such as the St. Jude Thaddeus Shrine in Barangay Cotta.',
        images: [
          photo('wedding', 'w4.jpg', 'A couple exchanges vows before the priest at the Kasalang Bayan'),
          photo('wedding', 'w1.jpg', 'Kasalang Bayan banner outside the St. Jude Thaddeus Shrine, Barangay Cotta'),
          photo('wedding', 'w2.jpg', 'Couples and guests fill the shrine for the mass wedding'),
          photo('wedding', 'w3.jpg', 'Guests greet a newlywed couple inside the shrine'),
          photo('wedding', 'w5.jpg', 'Newlywed couples pose with the priest at the altar'),
          photo('wedding', 'w6.jpg', 'Guests at the wedding reception table'),
        ],
      },
    ],
  },
  {
    name: 'Wellness',
    slug: 'wellness',
    summary: 'Car-free Sundays on Quezon Avenue for exercise and fun.',
    programs: [
      {
        name: 'Car-Free, Care-Free Sunday',
        description:
          'A recurring Sunday event that closes Quezon Avenue to vehicles so people can exercise and have fun. Activities include Zumba, Tabata, jogging, walking, jump rope, boxing and pickleball open play, plus special attractions such as RC Crawl-Free Sunday and the Trick-or-Treat Fitness Trail.',
        images: [
          photo('wellness', 'car1.jpg', 'A crowd dances Zumba on Quezon Avenue'),
          photo('wellness', 'car.jpg', 'An instructor leads Zumba from the stage at Car-Free, Care-Free Sunday'),
          photo('wellness', 'car2.jpg', 'A player returns the ball during pickleball open play on the street'),
          photo('wellness', 'car3.jpg', 'Participants do step workouts on platforms along the avenue'),
          photo('wellness', 'car5.jpg', 'Instructors lead a workout from a platform on the closed road'),
          photo('wellness', 'car4.jpg', 'Participants hold certificates in front of the Car-Free, Care-Free Sunday backdrop'),
        ],
      },
    ],
  },
];

/** The home page summary and the `/programs` introduction. */
export const PROGRAMS_OVERVIEW = {
  homeImage: photo('wellness', 'car1.jpg', 'A crowd dances Zumba on Quezon Avenue during Car-Free, Care-Free Sunday'),
  homeSummary:
    "Lucena City runs programs for its farmers, senior citizens, scholars, families and business owners, from free weddings and baptisms to housing and Car-Free Sundays.",
  bannerImage: photo('agricultural', 'a2.jpg', 'Farmers and city officials pose with a ceremonial cheque at the Lucena Convention Center'),
  introduction:
    "Lucena City runs programs that support its residents' livelihoods, health and welfare: inputs and health services for farmers, free movies and payouts for senior citizens, free community weddings and baptisms, business orientation, scholarships, housing, and Car-Free Sundays on Quezon Avenue.",
};

export function getProgramCategory(slug: string): ProgramCategory | undefined {
  return PROGRAM_CATEGORIES.find((category) => category.slug === slug);
}

export interface Content {
  id: string;
  title: string;
  type: "show" | "movie";
  genre: string[];
  year: string;
  rating: "G" | "PG" | "PG-13" | "R" | "TV-MA" | "TV-14" | "TV-PG";
  duration?: string; // For movies
  seasons?: number; // For shows
  episodes?: number; // For shows
  description: string;
  longDescription: string;
  image: string;
  backgroundImage: string;
  trailerUrl?: string;
  cast: CastMember[];
  director?: string;
  producer?: string;
  emmyNominations?: number;
  awards?: string[];
  releaseDate: string;
  featured?: boolean;
  trending?: boolean;
  newRelease?: boolean;
  comingSoon?: boolean;
  freePreview?: boolean;
}

export interface CastMember {
  name: string;
  role: string;
  image?: string;
}

export const contentDatabase: Content[] = [
  {
    id: "severance",
    title: "Severance",
    type: "show",
    genre: ["Thriller", "Mystery", "Sci-Fi"],
    year: "2022",
    rating: "TV-MA",
    seasons: 2,
    episodes: 19,
    description: "Don't miss the most talked-about show of the year.",
    longDescription:
      "Severance follows a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth about their jobs.",
    image: "https://ext.same-assets.com/3817037992/2862806227.svg",
    backgroundImage: "https://ext.same-assets.com/3817037992/4186230272.webp",
    trailerUrl: "https://player.vimeo.com/video/670684266",
    cast: [
      { name: "Adam Scott", role: "Mark" },
      { name: "Britt Lower", role: "Helly" },
      { name: "Zach Cherry", role: "Dylan" },
      { name: "Jen Tullock", role: "Devon" },
    ],
    director: "Ben Stiller",
    producer: "Ben Stiller",
    emmyNominations: 27,
    awards: ["Critics Choice Award", "Peabody Award"],
    releaseDate: "2022-02-18",
    featured: true,
    trending: true,
  },
  {
    id: "chief-of-war",
    title: "Chief of War",
    type: "show",
    genre: ["Drama", "Action", "Historical"],
    year: "2025",
    rating: "TV-MA",
    seasons: 1,
    episodes: 8,
    description:
      "A ferocious Hawaiian warrior embarks on an epic mission to unite his people.",
    longDescription:
      "Chief of War tells the incredible true story of the legendary Native Hawaiian King Kamehameha, voiced by Jason Momoa, who united the warring Hawaiian Islands to become the first King of Hawaii.",
    image: "https://ext.same-assets.com/3817037992/855966671.webp",
    backgroundImage: "https://ext.same-assets.com/3817037992/855966671.webp",
    trailerUrl: "https://player.vimeo.com/video/670684266",
    cast: [
      { name: "Jason Momoa", role: "Kamehameha" },
      { name: "Anna Sawai", role: "Keeaumoku" },
      { name: "Temuera Morrison", role: "Kaeo" },
    ],
    director: "Peter Ramsey",
    producer: "Jason Momoa",
    releaseDate: "2025-01-08",
    newRelease: true,
    trending: true,
    freePreview: true,
  },
  {
    id: "foundation",
    title: "Foundation",
    type: "show",
    genre: ["Sci-Fi", "Adventure", "Drama"],
    year: "2021",
    rating: "TV-14",
    seasons: 3,
    episodes: 30,
    description:
      "The fate of humanity hangs by a thread as a deadly new enemy unleashes his wrath.",
    longDescription:
      "Based on the award-winning novels by Isaac Asimov, Foundation chronicles a band of exiles on their monumental journey to save humanity and rebuild civilization amid the fall of the Galactic Empire.",
    image: "https://ext.same-assets.com/3817037992/877906450.webp",
    backgroundImage: "https://ext.same-assets.com/3817037992/877906450.webp",
    trailerUrl: "https://player.vimeo.com/video/670684266",
    cast: [
      { name: "Jared Harris", role: "Hari Seldon" },
      { name: "Lee Pace", role: "Brother Day" },
      { name: "Lou Llobell", role: "Gaal Dornick" },
    ],
    director: "David S. Goyer",
    producer: "David S. Goyer",
    releaseDate: "2021-09-24",
    featured: true,
    freePreview: true,
  },
  {
    id: "stick",
    title: "Stick",
    type: "show",
    genre: ["Comedy", "Sports"],
    year: "2025",
    rating: "TV-PG",
    seasons: 1,
    episodes: 10,
    description:
      "Owen Wilson is an ex-pro golfer taking a big swing at his second chance in this feel-good comeback story.",
    longDescription:
      "Stick follows an aging former golf prodigy who gets one last shot at redemption when he becomes the unlikely coach of a college golf team.",
    image: "https://ext.same-assets.com/3817037992/2755306390.webp",
    backgroundImage: "https://ext.same-assets.com/3817037992/2755306390.webp",
    cast: [
      { name: "Owen Wilson", role: "Mickey" },
      { name: "Anna Faris", role: "Sarah" },
    ],
    director: "Jason Reitman",
    releaseDate: "2025-01-15",
    newRelease: true,
    freePreview: true,
  },
  {
    id: "shrinking",
    title: "Shrinking",
    type: "show",
    genre: ["Comedy", "Drama"],
    year: "2023",
    rating: "TV-MA",
    seasons: 2,
    episodes: 20,
    description: "A therapist embraces a radical new approach.",
    longDescription:
      "Shrinking follows a grieving therapist who starts to tell his clients exactly what he thinks. Ignoring his training and ethics, he finds himself making huge, tumultuous changes to people's lives... including his own.",
    image: "https://ext.same-assets.com/3817037992/1326161353.svg",
    backgroundImage: "https://ext.same-assets.com/3817037992/1326161353.svg",
    cast: [
      { name: "Jason Segel", role: "Jimmy" },
      { name: "Harrison Ford", role: "Paul" },
      { name: "Jessica Williams", role: "Gaby" },
    ],
    emmyNominations: 7,
    releaseDate: "2023-01-27",
    featured: true,
  },
  {
    id: "the-gorge",
    title: "The Gorge",
    type: "movie",
    genre: ["Thriller", "Action"],
    year: "2025",
    rating: "PG-13",
    duration: "108 min",
    description: "Two elite snipers are stationed on opposite ends of a gorge.",
    longDescription:
      "The Gorge follows two elite snipers stationed on opposite ends of a gorge, protecting the world from a mysterious evil that lurks in the abyss below.",
    image: "https://ext.same-assets.com/3817037992/3034214751.webp",
    backgroundImage: "https://ext.same-assets.com/3817037992/3034214751.webp",
    cast: [
      { name: "Miles Teller", role: "Levi" },
      { name: "Anya Taylor-Joy", role: "Drasa" },
    ],
    director: "Scott Derrickson",
    releaseDate: "2025-02-14",
    newRelease: true,
    trending: true,
  },
  {
    id: "ted-lasso",
    title: "Ted Lasso",
    type: "show",
    genre: ["Comedy", "Sports", "Drama"],
    year: "2020",
    rating: "TV-MA",
    seasons: 3,
    episodes: 34,
    description: "Kindness makes a comeback in this heartwarming sensation.",
    longDescription:
      "Ted Lasso follows an American football coach who moves to England to manage a British soccer team—despite having no experience coaching soccer.",
    image: "https://ext.same-assets.com/3817037992/3350937708.svg",
    backgroundImage: "https://ext.same-assets.com/3817037992/3350937708.svg",
    cast: [
      { name: "Jason Sudeikis", role: "Ted Lasso" },
      { name: "Hannah Waddingham", role: "Rebecca Welton" },
      { name: "Brett Goldstein", role: "Roy Kent" },
    ],
    awards: ["Emmy Award", "Golden Globe"],
    releaseDate: "2020-08-14",
    featured: true,
  },
  {
    id: "the-morning-show",
    title: "The Morning Show",
    type: "show",
    genre: ["Drama"],
    year: "2019",
    rating: "TV-MA",
    seasons: 4,
    episodes: 40,
    description:
      "An inside look at the lives of the people who help America wake up.",
    longDescription:
      "The Morning Show explores the cutthroat world of morning news and the lives of the people who help America wake up in the morning.",
    image: "https://ext.same-assets.com/3817037992/4033354227.webp",
    backgroundImage: "https://ext.same-assets.com/3817037992/4033354227.webp",
    cast: [
      { name: "Jennifer Aniston", role: "Alex Levy" },
      { name: "Reese Witherspoon", role: "Bradley Jackson" },
      { name: "Steve Carell", role: "Mitch Kessler" },
    ],
    awards: ["SAG Award"],
    releaseDate: "2019-11-01",
    featured: true,
  },
];

export const getContentById = (id: string): Content | undefined => {
  return contentDatabase.find((content) => content.id === id);
};

export const searchContent = (query: string): Content[] => {
  if (!query.trim()) return contentDatabase;

  const lowerQuery = query.toLowerCase();
  return contentDatabase.filter(
    (content) =>
      content.title.toLowerCase().includes(lowerQuery) ||
      content.description.toLowerCase().includes(lowerQuery) ||
      content.genre.some((g) => g.toLowerCase().includes(lowerQuery)) ||
      content.cast.some((c) => c.name.toLowerCase().includes(lowerQuery)),
  );
};

export const getContentByType = (type: "show" | "movie"): Content[] => {
  return contentDatabase.filter((content) => content.type === type);
};

export const getTrendingContent = (): Content[] => {
  return contentDatabase.filter((content) => content.trending);
};

export const getFeaturedContent = (): Content[] => {
  return contentDatabase.filter((content) => content.featured);
};

export const getNewReleases = (): Content[] => {
  return contentDatabase.filter((content) => content.newRelease);
};

export const getFreePreviewContent = (): Content[] => {
  return contentDatabase.filter((content) => content.freePreview);
};

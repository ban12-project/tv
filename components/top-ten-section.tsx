import Image from "next/image";

interface TopTenItem {
  id: string;
  rank: number;
  title: string;
  genre: string;
  year?: string;
  image: string;
}

const topShows: TopTenItem[] = [
  {
    id: "chief-of-war",
    rank: 1,
    title: "Chief of War",
    genre: "Drama",
    image: "https://ext.same-assets.com/3817037992/855966671.webp",
  },
  {
    id: "foundation",
    rank: 2,
    title: "Foundation",
    genre: "Sci-Fi",
    image: "https://ext.same-assets.com/3817037992/877906450.webp",
  },
  {
    id: "stick",
    rank: 3,
    title: "Stick",
    genre: "Comedy",
    image: "https://ext.same-assets.com/3817037992/2755306390.webp",
  },
  {
    id: "smoke",
    rank: 4,
    title: "Smoke",
    genre: "Thriller",
    image: "https://ext.same-assets.com/3817037992/3068608778.webp",
  },
];

const topMovies: TopTenItem[] = [
  {
    id: "the-gorge",
    rank: 1,
    title: "The Gorge",
    genre: "Thriller",
    year: "2025",
    image: "https://ext.same-assets.com/3817037992/3034214751.webp",
  },
  {
    id: "fountain-of-youth",
    rank: 2,
    title: "Fountain of Youth",
    genre: "Action",
    year: "2025",
    image: "https://ext.same-assets.com/3817037992/3334972215.webp",
  },
  {
    id: "echo-valley",
    rank: 3,
    title: "Echo Valley",
    genre: "Thriller",
    year: "2025",
    image: "https://ext.same-assets.com/3817037992/561058921.webp",
  },
  {
    id: "wolfs",
    rank: 4,
    title: "Wolfs",
    genre: "Action",
    year: "2024",
    image: "https://ext.same-assets.com/3817037992/4218332357.webp",
  },
];

interface TopTenSectionProps {
  type: "shows" | "movies";
}

export default function TopTenSection({ type }: TopTenSectionProps) {
  const items = type === "shows" ? topShows : topMovies;
  const title = type === "shows" ? "Top 10 TV Shows" : "Top 10 Movies";
  const icon =
    type === "shows"
      ? "https://ext.same-assets.com/3817037992/465960788.svg"
      : "https://ext.same-assets.com/3817037992/2844472188.svg";

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-8">
          <h2 className="text-3xl font-bold text-white mr-4">{title}</h2>
          <Image src={icon} alt="" width={24} height={24} className="w-6 h-6" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.id} className="group cursor-pointer">
              <div className="relative overflow-hidden rounded-lg mb-3 content-card-hover">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={320}
                  height={192}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-3 left-3">
                  <div className="bg-white text-black w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg">
                    {item.rank}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <h3 className="text-white font-semibold text-lg mb-1">
                    {item.title}
                  </h3>
                  <p className="text-gray-300 text-sm">
                    {item.year && `${item.year} • `}
                    {item.genre}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

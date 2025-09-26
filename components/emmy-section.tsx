import Image from "next/image";

interface EmmyNominee {
  id: string;
  title: string;
  image: string;
  nominations: number;
}

const emmyNominees: EmmyNominee[] = [
  {
    id: "shrinking",
    title: "Shrinking",
    image: "https://ext.same-assets.com/3817037992/1326161353.svg",
    nominations: 7,
  },
  {
    id: "severance",
    title: "Severance",
    image: "https://ext.same-assets.com/3817037992/2862806227.svg",
    nominations: 27,
  },
  {
    id: "the-studio",
    title: "The Studio",
    image: "https://ext.same-assets.com/3817037992/3788123590.png",
    nominations: 23,
  },
  {
    id: "your-friends-neighbors",
    title: "Your Friends & Neighbors",
    image: "https://ext.same-assets.com/3817037992/917192458.svg",
    nominations: 1,
  },
];

export default function EmmySection() {
  return (
    <section className="py-16 bg-gradient-to-b from-transparent to-gray-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-white mb-12 text-center">
          2025 Emmy® Nominees on Apple TV+
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {emmyNominees.map((nominee) => (
            <div key={nominee.id} className="group cursor-pointer">
              <div className="relative overflow-hidden rounded-xl mb-4 content-card-hover">
                <Image
                  src={nominee.image}
                  alt={nominee.title}
                  width={400}
                  height={256}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute top-4 right-4">
                  <div className="bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold text-sm">
                    Emmy®
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-6">
                  <h3 className="text-white font-bold text-xl mb-2">
                    {nominee.title}
                  </h3>
                  <p className="text-yellow-400 font-semibold">
                    {nominee.nominations} Nomination
                    {nominee.nominations > 1 ? "s" : ""}
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

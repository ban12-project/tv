import Image from "next/image";

const devices = [
  {
    name: "Apple TV 4K",
    icon: "https://ext.same-assets.com/3817037992/2765466240.svg",
    featured: true,
  },
  {
    name: "Samsung",
    logo: "https://ext.same-assets.com/3817037992/2577735161.jpeg",
  },
  {
    name: "LG",
    logo: "https://ext.same-assets.com/3817037992/2351577297.jpeg",
  },
  {
    name: "VIZIO",
    logo: "https://ext.same-assets.com/3817037992/566805589.jpeg",
  },
  {
    name: "Sony",
    logo: "https://ext.same-assets.com/3817037992/1052554893.jpeg",
  },
  {
    name: "Xfinity",
    logo: "https://ext.same-assets.com/3817037992/1729749034.jpeg",
  },
  {
    name: "Roku",
    logo: "https://ext.same-assets.com/3817037992/1706578943.jpeg",
  },
  {
    name: "Fire TV",
    logo: "https://ext.same-assets.com/3817037992/2062141442.jpeg",
  },
  {
    name: "Google TV",
    logo: "https://ext.same-assets.com/3817037992/3857060184.jpeg",
  },
  {
    name: "PlayStation",
    logo: "https://ext.same-assets.com/3817037992/1730994510.jpeg",
  },
  {
    name: "Xbox",
    logo: "https://ext.same-assets.com/3817037992/3202595411.jpeg",
  },
];

const mobileDevices = [
  {
    name: "iPhone",
    icon: "https://ext.same-assets.com/3817037992/1106193212.svg",
  },
  {
    name: "iPad",
    icon: "https://ext.same-assets.com/3817037992/1045661145.svg",
  },
  {
    name: "Mac & Windows",
    icon: "https://ext.same-assets.com/3817037992/1777452955.svg",
  },
  {
    name: "Apple Vision Pro",
    icon: "https://ext.same-assets.com/3817037992/3868827331.svg",
  },
  {
    name: "AirPlay",
    icon: "https://ext.same-assets.com/3817037992/423344305.svg",
  },
  {
    name: "Android",
    icon: "https://ext.same-assets.com/3817037992/1297723314.svg",
  },
  {
    name: "Web",
    icon: "https://ext.same-assets.com/3817037992/1937371878.svg",
  },
];

export default function DeviceSection() {
  return (
    <section className="py-16 bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-12">
          <Image
            src="https://ext.same-assets.com/3817037992/3656600038.svg"
            alt="Apple TV+"
            width={130}
            height={48}
            className="h-12 mx-auto mb-6"
          />
          <h2 className="text-4xl font-bold text-white mb-4">
            Watch here and on your TV.
          </h2>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Find Apple TV+ on the TV app, available on your Apple devices, smart
            TVs, web and more.
          </p>
        </div>

        {/* TV Devices */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-16">
          {devices.map((device) => (
            <div
              key={device.name}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
            >
              {device.icon ? (
                <Image
                  src={device.icon}
                  alt={device.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 mb-3"
                />
              ) : (
                <Image
                  src={device.logo!}
                  alt={device.name}
                  width={100}
                  height={48}
                  className="h-12 w-auto mb-3 rounded"
                />
              )}
              <span className="text-white text-sm font-medium text-center">
                {device.name}
              </span>
            </div>
          ))}
        </div>

        {/* Mobile Devices */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-white mb-8">
            Watch on the go.
          </h3>
          <div className="flex justify-center items-center mb-6">
            <a
              href="/"
              className="text-blue-400 hover:text-blue-300 transition-colors flex items-center"
            >
              See all the ways to watch Apple TV+
              <Image
                src="https://ext.same-assets.com/3817037992/3132629344.svg"
                alt=""
                width={16}
                height={16}
                className="ml-2 w-4 h-4"
              />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 max-w-5xl mx-auto">
            {mobileDevices.map((device) => (
              <div
                key={device.name}
                className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
              >
                <Image
                  src={device.icon}
                  alt={device.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 mb-3"
                />
                <span className="text-white text-sm font-medium text-center">
                  {device.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

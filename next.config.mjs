/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/inventory", destination: "/dashboard", permanent: false },
      { source: "/parts", destination: "/dashboard", permanent: false },
      { source: "/login", destination: "/", permanent: false },
      { source: "/sign-in", destination: "/", permanent: false },
      { source: "/home", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;

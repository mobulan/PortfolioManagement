/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  output: 'export',
  images: {
    unoptimized: true
  }
};

export default nextConfig;

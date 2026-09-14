import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins:
    process.env.NODE_ENV === "development" ? ["192.168.1.30"] : [],
};

export default nextConfig;

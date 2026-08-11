import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitInfo = (() => {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    const time = execSync("git log -1 --format=%ci", { encoding: "utf-8" }).trim();
    return { hash, time };
  } catch {
    return { hash: "", time: "" };
  }
})();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_HASH: gitInfo.hash,
    NEXT_PUBLIC_GIT_TIME: new Date(gitInfo.time).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/iconArt";

export function GET() {
  return new ImageResponse(<IconArt size={512} />, { width: 512, height: 512 });
}

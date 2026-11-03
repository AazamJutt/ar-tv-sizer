import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/iconArt";

export function GET() {
  return new ImageResponse(<IconArt size={192} />, { width: 192, height: 192 });
}

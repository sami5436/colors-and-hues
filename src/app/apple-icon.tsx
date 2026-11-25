import { ImageResponse } from "next/og";

import { IconArt } from "@/lib/icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home screen and iMessage use this one. It needs an opaque background.
export default function AppleIcon() {
  return new ImageResponse(<IconArt size={180} padding={30} background="#f3f0e8" />, size);
}

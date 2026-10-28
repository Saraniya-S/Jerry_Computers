import { NextResponse, type NextRequest } from "next/server";
import { readImage } from "@/lib/server/uploads";

/** Serves uploaded images. Names are random and never reused, so they cache forever. */
export async function GET(_: NextRequest, { params }: RouteContext<"/uploads/[file]">) {
  const { file } = await params;
  const img = await readImage(file);
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img.data), {
    headers: { "content-type": img.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}

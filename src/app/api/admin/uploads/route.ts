import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { saveImage, UploadError } from "@/lib/server/uploads";

/** Image upload for admins (product photos, homepage images). Accepts up to 8 files per request. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, 8);
  if (!files.length) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  try {
    const urls = [];
    for (const f of files) urls.push(await saveImage(f));
    return NextResponse.json({ urls });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

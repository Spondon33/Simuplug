import { NextRequest } from "next/server";
import { getPageWords } from "@/lib/ocr-data";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; page: string }> }) {
  const { id, page } = await params;
  const words = await getPageWords(id, Number(page));
  if (!words) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ words }, { headers: { "Cache-Control": "public, max-age=86400" } });
}

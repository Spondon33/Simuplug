import { getIndex } from "@/lib/ocr-data";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getIndex());
}

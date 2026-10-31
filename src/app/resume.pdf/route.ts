import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchDrivePdf, resolveDrivePdfId } from "@/lib/resume";

export const runtime = "nodejs";
export const revalidate = 3600;

const FALLBACK = path.join(process.cwd(), "public", "resume-fallback.pdf");

/** GET /resume.pdf — the newest résumé from Drive, or the committed copy if Drive is unreachable. */
export async function GET(): Promise<Response> {
  let bytes: ArrayBuffer | null = null;
  try {
    const id = await resolveDrivePdfId();
    if (id) bytes = await fetchDrivePdf(id);
  } catch {
    bytes = null;
  }
  const body = bytes ?? (await readFile(FALLBACK)).buffer;
  return new Response(body as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Omjee_R_Giri_Resume.pdf"',
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "X-Resume-Source": bytes ? "drive" : "fallback",
    },
  });
}

/**
 * The résumé is a changing document, so the site never ships it as content. `/resume.pdf`
 * resolves to the PDF in a public Google Drive folder, cached for an hour, with the committed
 * copy as a fallback. Replacing the file in that folder is the whole update.
 */

export const RESUME_FOLDER_URL = "https://drive.google.com/drive/folders/1yZE2gbA6DWznqZIxx1S1_TL1xW4mSVy0";

const ONE_HOUR = 60 * 60;
const UA = { "User-Agent": "Mozilla/5.0 (portfolio resume sync)" };

/**
 * Find the PDF inside a public Drive folder. The folder page embeds each file's id a few
 * hundred characters before its name, which is enough to pair them without an API key.
 */
export async function resolveDrivePdfId(folderUrl = RESUME_FOLDER_URL): Promise<string | null> {
  const response = await fetch(folderUrl, { headers: UA, next: { revalidate: ONE_HOUR }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const html = await response.text();
  for (const match of html.matchAll(/"(1[A-Za-z0-9_-]{25,})"/g)) {
    const window = html.slice(match.index, (match.index ?? 0) + 500);
    if (/"[^"]{3,80}\.pdf"/.test(window)) return match[1];
  }
  return null;
}

export async function fetchDrivePdf(id: string): Promise<ArrayBuffer | null> {
  const response = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, {
    headers: UA,
    next: { revalidate: ONE_HOUR },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  // Drive answers HTML (an interstitial or an error page) with the same status; trust only real PDFs.
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-" ? bytes : null;
}

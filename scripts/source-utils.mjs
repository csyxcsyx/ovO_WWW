const invalidTitle = /visitor system|just a moment|access denied|checking your browser|验证码|安全验证|\ufffd/i;

export function decodePage(bytes, contentType = '') {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 8192));
  const charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]
    ?? head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? 'utf-8';
  try { return new TextDecoder(charset).decode(bytes); }
  catch { return new TextDecoder('utf-8').decode(bytes); }
}

export function pageTitle(html) {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/<[^>]*>/g, '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

export function usableSource(source) {
  return source?.status === 200 && Boolean(source.title) && !invalidTitle.test(source.title);
}

export async function checkSource(site) {
  const url = site.evidenceUrl ?? site.url;
  const checkedAt = new Date().toISOString().slice(0, 10);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(18000),
      headers: { 'user-agent': 'Mozilla/5.0 OfficialInspector-SourceCheck/2.0' } });
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (reader && size < 512000) {
        const part = await reader.read();
        if (part.done) break;
        const chunk = part.value.subarray(0, 512000 - size);
        chunks.push(chunk); size += chunk.length;
      }
    } finally { await reader?.cancel().catch(() => {}); }
    const html = decodePage(Buffer.concat(chunks), response.headers.get('content-type') ?? '');
    return { url, status: response.status, title: pageTitle(html), finalUrl: response.url, checkedAt };
  } catch (error) {
    return { url, status: 0, title: '', finalUrl: url, checkedAt, error: String(error.message).slice(0, 120) };
  }
}

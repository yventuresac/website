// RSS 2.0 파싱 유틸.
// 수집기와 메일리 미러가 함께 쓴다. 파서를 붙이지 않은 이유는 상대하는 피드가
// 전부 RSS 2.0 이기 때문이다. 형식이 흔들리는 소스가 생기면 그때 파서를 도입할 것.

export function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // 숫자·16진 참조까지 풀어야 한다. 국내 매체 피드에 &#8216; 같은 따옴표가 흔하다.
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')   // 이중 인코딩을 되살리지 않도록 마지막에
    .trim();
}

export function stripTags(s) {
  return decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tagText(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

export function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const sourceMatch = b.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
    items.push({
      title: stripTags(tagText(b, 'title')),
      link: tagText(b, 'link').trim(),
      pubDate: tagText(b, 'pubDate') || tagText(b, 'dc:date'),
      description: stripTags(tagText(b, 'description')),
      feedSource: sourceMatch ? stripTags(sourceMatch[1]) : '',
    });
  }
  return items;
}

// HTML 로 뱉을 때 쓴다. 디코딩한 뒤 다시 넣는 것이므로 순서를 지켜야 한다.
export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function fetchText(url, { timeout = 20000, ua } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua ?? 'Mozilla/5.0 (compatible; Y-VENTURES-Weekly/1.0; +https://www.yventures.ac)' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

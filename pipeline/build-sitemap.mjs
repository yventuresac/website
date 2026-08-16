#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// sitemap.xml 생성
//
// 페이지가 늘 때마다 손으로 고치면 반드시 빠뜨린다. 저장소를 훑어서 만든다.
//
// 제외 대상
//   - 리다이렉트 전용 페이지(greetings, history) — 색인에 넣으면 중복 취급된다
//   - 로그인·회원 전용(auth, members) — 검색 결과에 뜰 이유가 없다
//   - 내부 자료(imweb, admin-tools, pipeline)
//
// 사용법:
//   node pipeline/build-sitemap.mjs
//   node pipeline/build-sitemap.mjs --dry-run
// ─────────────────────────────────────────────────────────────

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ORIGIN = 'https://www.yventures.ac';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'pipeline', 'imweb', 'admin-tools', 'auth', 'members', 'assets', 'css', 'js', 'supabase', '.claude', '.github']);

const DRY_RUN = process.argv.includes('--dry-run');

async function findIndexPages(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await findIndexPages(join(dir, entry.name), out);
    } else if (entry.name === 'index.html') {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

// meta refresh 로 넘기는 페이지는 그 자체가 문서가 아니다.
// 다만 그런 스텁이 가리키는 정본(canonical)은 진짜 문서일 수 있다.
//   /insights/1/   → /insights/post.html?no=1   (실제 글)
//   /greetings/    → /about/                    (이미 목록에 있음 → 중복 제거)
async function inspect(file) {
  const html = await readFile(file, 'utf8');
  const redirect = /http-equiv=["']refresh["']/i.test(html);
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ?? [])[1] ?? null;
  return { redirect, canonical };
}

function toUrl(file) {
  const rel = relative(ROOT, dirname(file)).split(sep).join('/');
  return rel === '' ? `${ORIGIN}/` : `${ORIGIN}/${rel}/`;
}

// 목록 페이지와 개별 글의 우선순위를 나눈다
function priorityOf(url) {
  if (url === `${ORIGIN}/`) return '1.0';
  if (/\/insights\/post\.html/.test(url)) return '0.5';
  if (/\/(privacy)\/$/.test(url)) return '0.3';
  return '0.8';
}

const files = await findIndexPages(ROOT);
const seen = new Set();
for (const f of files) {
  const { redirect, canonical } = await inspect(f);
  if (!redirect) {
    seen.add(toUrl(f));
    continue;
  }
  // 스텁이면 정본을 대신 넣는다. 조각(#)만 다른 주소는 문서가 아니므로 버린다.
  if (canonical && canonical.startsWith('/') && !canonical.includes('#')) {
    seen.add(ORIGIN + canonical);
  }
}
const pages = [...seen].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url>\n    <loc>${u}</loc>\n    <priority>${priorityOf(u)}</priority>\n  </url>`).join('\n')}
</urlset>
`;

console.log(`페이지 ${pages.length}개`);
console.log(pages.filter((u) => !/\/insights\/post\.html/.test(u)).map((u) => '  ' + u).join('\n'));
console.log(`  (insights 개별 글 ${pages.filter((u) => /\/insights\/post\.html/.test(u)).length}개 포함)`);

if (DRY_RUN) {
  console.log('\n--dry-run 이므로 파일을 쓰지 않았습니다.');
} else {
  await writeFile(join(ROOT, 'sitemap.xml'), xml, 'utf8');
  console.log('\nsitemap.xml 생성 완료');
}

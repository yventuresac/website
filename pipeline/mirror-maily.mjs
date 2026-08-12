#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 메일리 지난 호 → 사이트 아카이브
//
// 메일리 RSS 가 주는 것은 제목·부제 한 줄·날짜·링크가 전부다.
// 본문과 이미지는 오지 않는다. 그래서 이 스크립트가 만드는 것은
// '본문 미러'가 아니라 '목차 카드'다. 본문을 보려면 메일리로 나간다.
//
// 앞으로 나갈 호는 이 방향이 아니다. 우리 DB 가 원본이 되고 사이트에 전문을
// 실은 뒤 메일리로 발송한다. 그래야 검색 유입이 우리 도메인에 쌓인다.
// 이 스크립트는 이미 메일리에만 있는 과거 호를 끌어오기 위한 것이다.
//
// 사용법:
//   node pipeline/mirror-maily.mjs --dry-run
//   node pipeline/mirror-maily.mjs
// ─────────────────────────────────────────────────────────────

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { parseRss, fetchText, escapeHtml } from './rss.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = join(HERE, '..', 'newsletter', 'index.html');
const IMG_DIR = join(HERE, '..', 'assets', 'newsletter');
const FEED = 'https://maily.so/yventures/feed';

const START = '<!-- maily:archive:start';
const END = '<!-- maily:archive:end -->';
const PROOF_START = '<!-- maily:proof:start';
const PROOF_END = '<!-- maily:proof:end -->';

// 썸네일 표시 크기. img 에 width/height 를 박아 지연 로딩 때 목록이 밀리지 않게 한다.
const THUMB_W = 104;
const THUMB_H = 72;

// 표시 구간을 통째로 갈아끼운다. 시작 주석 줄은 남기고 그 다음부터 끝 주석 앞까지.
function replaceBlock(html, startMark, endMark, block, indent) {
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark);
  if (s < 0 || e < 0 || e < s) return null;
  const lineEnd = html.indexOf('\n', s);
  return html.slice(0, lineEnd + 1) + block + '\n' + indent + html.slice(e);
}

const DRY_RUN = process.argv.includes('--dry-run');

function formatDate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const postIdOf = (link) => (link.match(/\/posts\/([^/?#]+)/) ?? [])[1] ?? '';

// 대표 사진은 RSS 에 없다. 호 페이지의 og:image 에 걸려 있어서 거기서 꺼낸다.
async function coverImageUrl(postUrl) {
  try {
    const html = await fetchText(postUrl);
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
          ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// 메일리 CDN 을 그대로 링크하지 않고 내려받아 저장소에 둔다.
// 우리가 올린 사진이라 저작권 문제는 없고, 남의 CDN 에 의존하면
// 계정을 닫거나 이미지를 지우는 순간 사이트에서 깨진다.
//
// 원본은 한 장에 3MB 가까이 된다. 104×72 썸네일 하나 보여주려고 그걸 내려받게 하면
// 아카이브 페이지가 통째로 무거워지므로 받는 즉시 줄여서 저장한다.
const THUMB_WIDTH = 480;

async function downloadCover(url, postId) {
  const rel = `assets/newsletter/${postId}.webp`;
  const abs = join(IMG_DIR, `${postId}.webp`);

  try {
    await access(abs);
    return rel;                      // 이미 받아둔 것은 다시 받지 않는다
  } catch { /* 없으면 내려받는다 */ }

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  if (!res.ok) return null;

  const raw = Buffer.from(await res.arrayBuffer());
  await mkdir(IMG_DIR, { recursive: true });
  const out = await sharp(raw)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  await writeFile(abs, out);
  return rel;
}

// process.exit() 를 쓰지 않는다. 윈도우에서 열린 소켓이 남은 채로 강제 종료하면
// libuv 가 assertion 으로 죽어 종료 코드가 127 로 튄다(CI 에서 실패로 잡힌다).
// 자연 종료시키고 실패는 exitCode 로만 알린다.
async function main() {
  const items = parseRss(await fetchText(FEED));
  if (!items.length) {
    console.error('메일리 피드에서 항목을 찾지 못했습니다. 파일을 건드리지 않고 종료합니다.');
    process.exitCode = 1;
    return;
  }

  // 대표 사진 확보. 호 수가 적어 순차로 돌려도 몇 초면 끝난다.
  const covers = [];
  for (const it of items) {
    const id = postIdOf(it.link);
    const src = id ? await coverImageUrl(it.link) : null;
    covers.push(src ? await downloadCover(src, id).catch(() => null) : null);
  }

  // 피드는 최신순이다. 호수는 오래된 것부터 1번.
  const total = items.length;
  const cards = items.map((it, i) => {
    const vol = total - i;
    const cover = covers[i];
    const thumb = cover
      ? `\n        <div class="nl-issue-thumb"><img src="../${cover}" alt="" width="${THUMB_W}" height="${THUMB_H}" loading="lazy" decoding="async" /></div>`
      : '';
    return `      <a href="${escapeHtml(it.link)}" class="nl-issue-card" target="_blank" rel="noopener">${thumb}
        <div class="nl-issue-body">
          <div class="nl-issue-meta"><span>Vol. ${vol}</span><span>·</span><span>${formatDate(it.pubDate)}</span></div>
          <h3>${escapeHtml(it.title)}</h3>
          <p>${escapeHtml(it.description)}</p>
        </div>
      </a>`;
  }).join('\n');

  const block = `    <div class="nl-archive">\n${cards}\n    </div>`;

  // 구독자 수는 메일리가 서버 응답에 내려주지 않아(클라이언트에서 API 호출) 긁어올 수 없다.
  // 손으로 적은 숫자는 반드시 낡으므로, RSS 로 확실히 아는 발행 호수를 쓴다.
  const proof = `      <div class="nl-proof"><span class="nl-proof-dot"></span>지금까지 <strong>${total}개 호</strong> 발행</div>`;

  const html = await readFile(TARGET, 'utf8');
  const withArchive = replaceBlock(html, START, END, block, '    ');
  if (!withArchive) {
    console.error(`${TARGET} 에서 maily:archive 표시를 찾지 못했습니다.`);
    process.exitCode = 1;
    return;
  }
  const next = replaceBlock(withArchive, PROOF_START, PROOF_END, proof, '      ') ?? withArchive;

  console.log(`메일리 ${total}개 호를 읽었습니다. (대표 사진 ${covers.filter(Boolean).length}장)`);
  for (const [i, it] of items.entries()) {
    console.log(`  Vol.${total - i}  ${formatDate(it.pubDate)}  ${covers[i] ? '📷' : '  '}  ${it.title}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run 이므로 파일을 쓰지 않았습니다.');
    return;
  }
  if (next === html) {
    console.log('바뀐 내용이 없습니다.');
    return;
  }

  await writeFile(TARGET, next, 'utf8');
  console.log(`\n${TARGET} 갱신 완료`);
}

await main();

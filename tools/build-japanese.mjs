/**
 * Regenerate the Japanese page from index.html.
 * Run: node tools/build-japanese.mjs (Node 18+, no dependencies).
 * Fails on untranslated Chinese text/labels; proper names are explicit entries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildJapanese(source, translations) {
  const base = 'https://tutminchai.github.io/minchaihsieh/';
  const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':'\u00a0'};
    return named[entity] ?? String.fromCodePoint(parseInt(entity.slice(entity[2]?.toLowerCase()==='x'?3:2,-1),entity[2]?.toLowerCase()==='x'?16:10));
  });
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const missing = new Set();
  const translate = s => {
    const decoded=decode(s),key=decoded.trim();
    if (Object.hasOwn(translations,key)) return escape(decoded.replace(key,translations[key]));
    if (/[\u3400-\u9fff]/u.test(key)) missing.add(key);
    return s;
  };
  let html=source;
  html=html.replace(/<div\b[^>]*class="bio-tabs"[^>]*>[\s\S]*?<\/div>/, '');
  html=html.replace(/<div\b[^>]*id="bio-en"[^>]*>[\s\S]*?<\/div>/, '');
  html=html.replace(/<div\b[^>]*id="bio-zh"[^>]*>/, '<div class="bio-panel" id="bio-ja" lang="ja">');
  // Preserve original institution and talk names for Chinese-keyword searches.
  html=html.replace(/(<li\b[^>]*class="archive-record"[^>]*)(>)([\s\S]*?)(<\/li>)/g,
    (_,tag,close,body,end)=>tag+' data-search-original="'+escape(decode(body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()))+'">'+body+end);
  html=html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<[^>]+>|[^<]+/gi, token => {
    if (/^(?:<!--|<script\b|<style\b)/i.test(token)) return token;
    if (token.startsWith('<')) return token.replace(/\b(aria-label|placeholder|title|alt)="([^"]*)"/g,(_,attr,value)=>attr+'="'+translate(value)+'"');
    return translate(token);
  });
  if(missing.size) throw Error('Missing Japanese translations:\n'+[...missing].sort().join('\n'));
  html=html.replace('<html lang="zh-Hant">','<html lang="ja">');
  const meta=(key,value)=>{
    const pattern=new RegExp('<meta\\b(?=[^>]*(?:name|property)="'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'")[^>]*>','g');
    html=html.replace(pattern,tag=>tag.replace(/content="[^"]*"/,'content="'+escape(value)+'"'));
  };
  const description='謝旻儕（Min-Chai Hsieh）博士。台南応用科技大学准教授。AI、デジタル学習、XR、教育メタバース、インタラクションデザインの研究・教育・実践、著書と講演記録を紹介。';
  meta('description',description);meta('og:description',description);
  meta('og:locale','ja_JP');meta('og:url',base+'ja.html');
  meta('og:title',decode(html.match(/<title>([^<]+)<\/title>/)[1]));
  html=html.replace(/<link\b(?=[^>]*rel="canonical")[^>]*>/,'<link href="'+base+'ja.html" rel="canonical"/>');
  html=html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(_,start,json,end)=>{
    const person=JSON.parse(json);
    person.jobTitle='准教授';person.url=base+'ja.html';
    person.worksFor.name='台南応用科技大学';person.alumniOf.name='国立台南大学';
    return start+JSON.stringify(person)+end;
  });
  html=html.replace(/<a\b[^>]*data-language="([^"]+)"[^>]*>/g,(tag,lang)=>{
    tag=tag.replace(/\saria-current="[^"]*"/g,'');
    return lang==='ja'?tag.replace(/>$/,' aria-current="page">'):tag;
  });
  html=html.replace('<div class="books-grid">','<p class="book-edition-note">書籍はすべて繁体字中国語版です。日本語の書名は参考訳です。</p>\n<div class="books-grid">');
  const email='mailto:shiehminchai@gmail.com?subject='+encodeURIComponent('講演・ワークショップについてのご相談')+'&body='+encodeURIComponent('謝先生\n\n講演・ワークショップについてご相談いたします。\n\n学校・機関名：\n担当者・連絡先：\n希望テーマ：\n対象者・予定人数：\n希望日程・所要時間：\n会場・オンライン形式：\nその他のご要望：\n\nよろしくお願いいたします。');
  html=html.replace(/<a\b(?=[^>]*class="invite-email")[^>]*>/,tag=>tag.replace(/href="[^"]*"/,'href="'+escape(email)+'"'));
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const translations = {
    ...JSON.parse(read('translations/ja.json')),
    ...JSON.parse(read('translations/archive.ja.json'))
  };
  const page = buildJapanese(read('index.html'), translations);
  writeFileSync(new URL('ja.html', root), page);
  console.log('Generated ja.html:', (page.match(/class="archive-record"/g) || []).length, 'talks,', (page.match(/class="book"/g) || []).length, 'books.');
}

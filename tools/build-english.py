"""Regenerate the static English page after editing index.html and translations.

Requires beautifulsoup4. Hosting itself has no build/runtime dependency.
Missing translations fail the build rather than silently publishing Chinese UI.
"""
from pathlib import Path
from urllib.parse import urlencode
import json
import re
from bs4 import BeautifulSoup, Comment, Doctype

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://tutminchai.github.io/minchaihsieh/'
soup = BeautifulSoup((ROOT / 'index.html').read_text(), 'html.parser')
translations = json.loads((ROOT / 'translations/en.json').read_text())
translations.update(json.loads((ROOT / 'translations/archive.en.json').read_text()))
translations.update({
    '中文': '中文',
    '博客來': 'Books.com.tw',
    '博客來搜尋': 'Search Books.com.tw',
    '誠品線上': 'Eslite',
    '金石堂': 'Kingstone',
    '書籍為繁體中文版。': 'All books are published in Traditional Chinese. English titles are provided for reference.',
    '謝旻儕，回到首頁': 'Min-Chai Hsieh — Home',
    '謝旻儕個人圖記：圓環、書頁與日光': 'Personal emblem: a circle, open book and sunlight',
    '開啟導覽選單': 'Open navigation menu',
    '主要導覽': 'Main navigation',
    '切換網站語言': 'Website language',
    '研究領域：人工智慧應用、數位學習、延展實境（混合實境、擴增實境、虛擬實境）、教育元宇宙、互動設計': 'Research fields: AI applications, digital learning, extended reality (MR, AR and VR), educational metaverse and interaction design',
    '演講區塊導覽': 'Talks navigation',
    '研究與實作成果分類': 'Research and practice categories',
    '篩選研究計畫': 'Filter research projects',
    '關閉演講紀錄': 'Close talk archive',
    '例如：AI、擴增實境、成功大學': 'e.g. AI, augmented reality, Cheng Kung',
    '演講紀錄列表': 'Talk records',
    '演講邀約小幫手': 'Contact and talk information',
    '關閉邀約小幫手': 'Close contact panel',
    '選擇常見問題': 'Choose a frequently asked question',
})

# Use the existing, approved English biography as the English page's biography.
soup.select_one('.bio-tabs').decompose()
soup.select_one('#bio-zh').decompose()
bio = soup.select_one('#bio-en')
for attr in ('hidden', 'role', 'aria-labelledby', 'tabindex'):
    bio.attrs.pop(attr, None)

# Keep the original wording searchable without displaying two long copies.
for row in soup.select('.archive-record'):
    row['data-search-original'] = row.get_text(' ', strip=True)

missing = set()
def translate(value):
    key = value.strip()
    if not re.search(r'[\u4e00-\u9fff]', key):
        return value
    if key not in translations:
        missing.add(key)
        return value
    return value.replace(key, translations[key], 1)

for node in list(soup.find_all(string=True)):
    if node.parent.name in ('script', 'style') or isinstance(node, (Comment, Doctype)):
        continue
    node.replace_with(translate(str(node)))
for tag in soup.find_all(True):
    for attr in ('aria-label', 'placeholder', 'title'):
        if attr in tag.attrs:
            tag[attr] = translate(tag[attr])
    if tag.name == 'img':
        if tag.find_parent(class_='book'):
            title = tag.find_parent(class_='book').h3.get_text(' ', strip=True)
            tag['alt'] = title + ' — original Chinese edition cover'
        else:
            tag['alt'] = translate(tag.get('alt', ''))

if missing:
    raise SystemExit('Missing English translations:\n' + '\n'.join(sorted(missing)))

soup.html['lang'] = 'en'
soup.select_one('link[rel="canonical"]')['href'] = BASE + 'en.html'
description = 'Min-Chai Hsieh, Ph.D., Associate Professor at Tainan University of Technology. Research, teaching, books and talks in AI, digital learning, XR, the educational metaverse and interaction design.'
for selector in ('meta[name="description"]', 'meta[property="og:description"]'):
    soup.select_one(selector)['content'] = description
for selector in ('meta[property="og:site_name"]', 'meta[name="application-name"]'):
    soup.select_one(selector)['content'] = 'Min-Chai Hsieh'
soup.select_one('meta[property="og:locale"]')['content'] = 'en_US'
soup.select_one('meta[property="og:title"]')['content'] = soup.title.get_text()
soup.select_one('meta[property="og:url"]')['content'] = BASE + 'en.html'
schema = soup.select_one('script[type="application/ld+json"]')
person = json.loads(schema.string)
person.update(name='Min-Chai Hsieh', alternateName='謝旻儕', jobTitle='Associate Professor', url=BASE+'en.html')
person['worksFor']['name'] = 'Tainan University of Technology'
person['alumniOf']['name'] = 'National University of Tainan'
schema.string = json.dumps(person, ensure_ascii=False, separators=(',', ':'))

for link in soup.select('[data-language]'):
    link.attrs.pop('aria-current', None)
    if link['data-language'] == 'en':
        link['aria-current'] = 'page'

# A compact identity, with the original Chinese name retained as a proper name.
brand = soup.select_one('.brand-name')
brand.clear()
brand.append('Min-Chai Hsieh')
sub = soup.new_tag('span', lang='zh-Hant')
sub.string = '謝旻儕 · Ph.D.'
brand.append(sub)
soup.select_one('.field-caption span:last-child').string = '01—05'
note = soup.new_tag('p', attrs={'class': 'book-edition-note'})
note.string = 'All books are published in Traditional Chinese. English titles are provided for reference.'
soup.select_one('.books-grid').insert_before(note)

for span in soup.select('.practice-meta > span'):
    text = span.get_text()
    if text.startswith('Student: '):
        span.clear()
        span.append('Student: ')
        name = soup.new_tag('span', lang='zh-Hant')
        name.string = text.removeprefix('Student: ')
        span.append(name)

email = soup.select_one('.invite-email')
email['href'] = 'mailto:shiehminchai@gmail.com?' + urlencode({
    'subject': 'Talk / workshop inquiry',
    'body': 'Dear Dr. Hsieh,\n\nWe would like to discuss a talk or workshop.\n\nSchool / organization:\nContact person and details:\nTopic:\nAudience and estimated number of participants:\nPreferred date and duration:\nVenue / online format:\nOther requirements:\n\nThank you.'
}, quote_via=__import__('urllib.parse', fromlist=['quote']).quote)
(ROOT / 'en.html').write_text(str(soup) + '\n')
print('Generated en.html with', len(soup.select('.archive-record')), 'talks and', len(soup.select('.book')), 'books.')

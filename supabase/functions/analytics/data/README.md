# Taiwan city IP lookup data

`tw-city.json` is a compact, offline Taiwan-only derivative of **DB-IP City Lite,
November 2026**. It contains public network ranges, not visitor records.

## Source and attribution

- Official download page: https://db-ip.com/db/download/ip-to-city-lite
- Source: https://download.db-ip.com/free/dbip-city-lite-2026-11.csv.gz
- License: Creative Commons Attribution 4.0 International
  (https://creativecommons.org/licenses/by/4.0/).
- Required attribution link on result pages: [IP Geolocation by DB-IP](https://db-ip.com).
- Changes: Taiwan (`TW`) ranges retained; coordinates and unrelated countries
  removed; identical adjacent ranges merged; region/city strings dictionary-encoded.
- Official SHA1 of uncompressed CSV, verified during this build:
  `254ef60b261cb4fb613362058b388a480d2a6b92`.
- SHA256 of this `tw-city.json`:
  `93a7e68b6d2289e358a710a1d692e3ef66b77eeb45a0748d19b9d5739cabc69d`.
- Source archive SHA256 and CSV SHA256 are also embedded in JSON metadata.

## Reproduce / monthly update

Use Python 3 and curl. Obtain the current month and official SHA1 from the official
download page, then run:

```sh
python3 tools/build-tw-city.py --release 2026-11 \
  --expected-sha1 254ef60b261cb4fb613362058b388a480d2a6b92 \
  --out supabase/functions/analytics/data/tw-city.json
```

The command downloads the monthly official CSV gzip and validates its contents.
For an already downloaded source, add
`--source-file dbip-city-lite-2026-11.csv.gz`.
Generate on a development computer or build runner, not on an Edge request.
DB-IP updates the Lite database monthly. Replace the complete derivative after a
successful validation; retain the previous known-good file if download fails.

## JSON format

- `locations`: `[stateprov, city]`, copied verbatim from DB-IP CSV.
- `ipv4`: sorted, nonoverlapping inclusive `[startNumber, endNumber, locationIndex]`.
- `ipv6`: sorted, nonoverlapping inclusive `[startHex32, endHex32, locationIndex]`.
  Fixed-width lowercase hexadecimal strings may be compared lexicographically.
- `source` and `release`: provenance, license, and integrity metadata.

Binary search the appropriate array. A missing range must return no city. Do not
force a Taiwan result for an unrelated IP, or infer a city from browser language.

## Verified size and counts

- 85,713,797-byte compressed source; 692,439,978-byte uncompressed CSV.
- Source contains 7,777,816 ranges; 37,070 have country `TW`.
- Output: 1,002,575 bytes (less than 1 MiB).
- Output: 28,430 IPv4 ranges, 3,640 IPv6 ranges, 138 region/city pairs.
- No external per-visitor IP lookup is needed at runtime.

## Location limitations

The source state/province values in the Taiwan subset are legacy coarse labels:
`Fukien`, `Kaohsiung`, `Taipei`, `Taiwan`. They are not a current county list.
City values include major cities, districts, villages, and sometimes ambiguous
small places. For Chinese presentation, map only unambiguous verified names;
retain source text or show the country when the place cannot be resolved.
Do not present guesses as Taiwan county locations.

IP geolocation estimates a network location. Carrier routing, VPNs, and database
accuracy affect the result; it is not a visitor's GPS location.

Public dataset examples for deterministic tests (these are not visitor IPs):

| IP | Original region | Original city |
| --- | --- | --- |
| 1.172.33.0 | Taiwan | Tainan |
| 1.172.129.0 | Kaohsiung | Kaohsiung City |
| 1.172.32.0 | Taiwan | Yongkang District |
| 1.172.72.0 | Taiwan | Xinying District |
| 2001:b011:: | Kaohsiung | Kaohsiung City |
| 2407:9240:3109:: | Taiwan | Tainan City |

Official references:

- CSV columns: https://db-ip.com/db/format/ip-to-city-lite/csv.html
- Update / accuracy FAQ: https://db-ip.com/faq.php
- Supabase limits: https://supabase.com/docs/guides/functions/limits

Chinese name mapping references for district-to-city normalization:

- Yongkang: https://yungkang-house.tainan.gov.tw/en/
- Xinying: https://xinying.tainan.gov.tw/en/cp.aspx?n=8647
- Fongshan / Fengshan: https://www.kcg.gov.tw/EN/cp.aspx?n=C8B81163CD9BA0FD

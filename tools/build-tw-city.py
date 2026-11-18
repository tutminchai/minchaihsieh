#!/usr/bin/env python3
"""Build a compact Taiwan-only DB-IP City Lite dataset, without visitor data.

Input: official monthly CSV gzip. Output: deterministic numeric IPv4 and
zero-padded hexadecimal IPv6 ranges, sharing a region/city dictionary.
CC BY 4.0 attribution must accompany redistributed output and result pages.
"""
import argparse
import csv
import gzip
import hashlib
import io
import ipaddress
import json
from pathlib import Path
import re
import subprocess


class DigestReader(io.RawIOBase):
    def __init__(self, wrapped):
        self.wrapped = wrapped
        self.sha1 = hashlib.sha1()
        self.sha256 = hashlib.sha256()
        self.size = 0

    def readable(self):
        return True

    def readinto(self, buffer):
        content = self.wrapped.read(len(buffer))
        count = len(content)
        buffer[:count] = content
        self.sha1.update(content)
        self.sha256.update(content)
        self.size += count
        return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release', required=True, help='YYYY-MM')
    parser.add_argument('--source-file', type=Path)
    parser.add_argument('--expected-sha1', help='Official download-page SHA1')
    parser.add_argument('--out', type=Path, default=Path('tw-city.json'))
    args = parser.parse_args()
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', args.release):
        parser.error('release must be YYYY-MM')
    if args.expected_sha1 and not re.fullmatch(r'[a-fA-F0-9]{40}', args.expected_sha1):
        parser.error('expected SHA1 must be 40 hex characters')
    url = f'https://download.db-ip.com/free/dbip-city-lite-{args.release}.csv.gz'
    source = args.source_file or args.out.parent / f'dbip-city-lite-{args.release}.csv.gz'
    source.parent.mkdir(parents=True, exist_ok=True)
    if not args.source_file:
        subprocess.run(['curl', '--fail', '--location', '--retry', '2', '--max-time', '240',
                        '--output', str(source), url], check=True)
    source_sha1 = hashlib.sha1()
    source_sha256 = hashlib.sha256()
    with source.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            source_sha1.update(chunk)
            source_sha256.update(chunk)
    locations = []
    location_index = {}
    ranges = {4: [], 6: []}
    total_rows = 0
    tw_rows = 0
    with gzip.open(source, 'rb') as zipped:
        reader = DigestReader(zipped)
        with io.TextIOWrapper(io.BufferedReader(reader), encoding='utf-8', newline='') as text:
            for row in csv.reader(text):
                total_rows += 1
                if len(row) != 8:
                    raise ValueError(f'Unexpected CSV column count at row {total_rows}')
                if row[3] != 'TW':
                    continue
                start, end = ipaddress.ip_address(row[0]), ipaddress.ip_address(row[1])
                if start.version != end.version or int(start) > int(end):
                    raise ValueError(f'Invalid IP range at row {total_rows}')
                location = (row[4], row[5])
                if location not in location_index:
                    location_index[location] = len(locations)
                    locations.append(list(location))
                ranges[start.version].append([int(start), int(end), location_index[location]])
                tw_rows += 1
    expected = (args.expected_sha1 or '').lower()
    if expected and expected not in (source_sha1.hexdigest(), reader.sha1.hexdigest()):
        raise ValueError('Official SHA1 does not match compressed or uncompressed source')
    original_counts = {str(version): len(rows) for version, rows in ranges.items()}
    for version, rows in ranges.items():
        rows.sort()
        merged = []
        for start, end, loc in rows:
            if merged and start <= merged[-1][1]:
                raise ValueError(f'Overlapping IPv{version} ranges')
            if merged and start == merged[-1][1] + 1 and loc == merged[-1][2]:
                merged[-1][1] = end
            else:
                merged.append([start, end, loc])
        ranges[version] = merged
    data = {
        'schema': 1,
        'country': 'TW',
        'release': args.release,
        'source': {
            'name': 'DB-IP City Lite',
            'url': url,
            'license': 'CC-BY-4.0',
            'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
            'attribution': 'IP Geolocation by DB-IP',
            'attributionUrl': 'https://db-ip.com',
            'modifications': 'Taiwan ranges only; coordinates removed; identical adjacent ranges merged; dictionary encoding.',
            'sha256Gzip': source_sha256.hexdigest(),
            'sha256Csv': reader.sha256.hexdigest(),
            'sha1Csv': reader.sha1.hexdigest(),
            'csvBytes': reader.size,
            'sourceRows': total_rows,
            'taiwanRows': tw_rows,
            'sourceRanges': original_counts,
        },
        'locations': locations,
        'ipv4': ranges[4],
        'ipv6': [[f'{a:032x}', f'{b:032x}', loc] for a, b, loc in ranges[6]],
    }
    encoded = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    if not ranges[4] or not ranges[6] or not locations:
        raise ValueError('Missing Taiwan IP family or location data')
    if len(encoded) > 1048576:
        raise ValueError(f'Dataset exceeds 1 MiB: {len(encoded)} bytes')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(encoded)
    print(json.dumps({'file':str(args.out), 'bytes':len(encoded),
        'sha256':hashlib.sha256(encoded).hexdigest(), 'twRows':tw_rows,
        'ipv4Ranges':len(ranges[4]), 'ipv6Ranges':len(ranges[6]),
        'locations':len(locations), 'regions':sorted({x[0] for x in locations}),
        'cities':sorted({x[1] for x in locations}),
        'officialSha1Verified':bool(expected)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

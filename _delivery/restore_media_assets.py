#!/usr/bin/env python3
"""Restore referenced binary media from the original raw GitHub URLs.
Runs only on explicit --restore; never overwrites existing files by default.
"""
import argparse
from pathlib import Path
import json
from urllib.request import urlopen, Request

parser=argparse.ArgumentParser()
parser.add_argument('--restore',action='store_true',help='Actually retrieve missing assets from the URLs')
parser.add_argument('--overwrite',action='store_true',help='Overwrite existing assets (use only after checking original media)')
args=parser.parse_args()
base=Path(__file__).resolve().parent.parent
assets=json.loads((Path(__file__).parent/'MEDIA_FROM_TEXT_EXPORT.json').read_text())
for item in assets:
    rel=Path(item['path'])
    destination=(base/rel).resolve()
    if not destination.is_relative_to(base):
        raise RuntimeError('Invalid asset path')
    if destination.exists() and not args.overwrite:
        print('SKIP existing',rel)
        continue
    if not args.restore:
        print('MISSING (restore with --restore):',rel)
        continue
    if not item['url'].startswith('https://raw.githubusercontent.com/Sanjuan1290/dc_prime_realty_system/'):
        raise RuntimeError('Unexpected URL source')
    request=Request(item['url'],headers={'User-Agent':'DC-Prime-Media-Restore/1.0'})
    with urlopen(request,timeout=25) as response:
        content=response.read()
    if not content:
        raise RuntimeError(f'Empty asset: {rel}')
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_bytes(content)
    print('RESTORED',rel,len(content),'bytes')

#!/usr/bin/env python3
"""Restore media listed in DOCS/MISSING_ORIGINAL_MEDIA.json from original repository.
Network required. Requires explicit --download. Existing files are never overwritten.
Do not rely on Git HEAD matching the October 27 code snapshot.
"""
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
import json,argparse
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');args=parser.parse_args()
assets=json.loads((root/'DOCS/MISSING_ORIGINAL_MEDIA.json').read_text())
for row in assets:
 dest=(root/row['destination']).resolve()
 if not dest.is_relative_to(root.resolve()):raise SystemExit('Bad path')
 url=row['source_url'];info=urlparse(url)
 if info.scheme!='https' or info.hostname!='raw.githubusercontent.com':raise SystemExit('Untrusted media host')
 if dest.exists():continue
 print(('Download' if args.download else 'MISSING'), dest.relative_to(root))
 if args.download:
  dest.parent.mkdir(parents=True,exist_ok=True)
  try:
   with urlopen(url,timeout=30) as r:
    contents=r.read(40_000_001)
   if len(contents)>40_000_000:raise ValueError('Too large')
   dest.write_bytes(contents)
  except Exception as e:print('FAILED',str(e))

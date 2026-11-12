#!/usr/bin/env python3
"""Read-only local HTTP checks; run the production build without Supabase/job secrets first."""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3100'
if not base.startswith(('http://127.0.0.1:', 'http://localhost:')):
    raise SystemExit('Refusing smoke tests against a non-local application')

def request(path, method='GET', headers=None):
    try:
        response = urllib.request.urlopen(urllib.request.Request(base+path, method=method, headers=headers or {}), timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, response.read().decode('utf-8', errors='replace')

for _ in range(30):
    try:
        status, body = request('/')
        break
    except urllib.error.URLError:
        time.sleep(0.5)
else:
    raise AssertionError('Local application did not become ready')

routes = json.loads(Path('public/manus-routes.json').read_text())['routes']
for route in routes:
    status, body = request(route['path'])
    assert status == 200, (route['path'], status, body[:300])
    assert '<html' in body.lower(), route['path']
    assert 'Something went wrong' not in body, route['path']
    print(f"PASS: {route['path']} HTTP200 without optional or mandatory Supabase variables", flush=True)
status, body = request('/api/public/hooks/process-jobs')
assert status == 405, (status, body)
print('PASS: unauthenticated GET cannot mutate investment/financial records')
status, body = request('/api/public/hooks/process-jobs', 'POST')
assert status == 503, (status, body)
print('PASS: job processing is safely unavailable when its server-only secret is absent')
status, body = request('/manus-routes.json')
assert status == 200 and json.loads(body) == {'routes': routes}, (status, body[:100])
print('PASS: route declaration exactly matches existing application pages')

import concurrent.futures
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'content/cet-local/index.json').read_text())
index = json.loads((root / '.local-cet-import/original-text-index.json').read_text())
assets = {a['id']: a for i in manifest['items'] for a in i['resources']}
output = root / '.local-cet-import/source-ocr-en'
output.mkdir(exist_ok=True)

def recognize(identity):
    target = output / (identity + '.json')
    if not target.exists():
        process = subprocess.run([str(root / '.local-cet-import/ocr-pdf-en'),
            str(root / ('public' + assets[identity]['url'])), str(target)], capture_output=True, text=True)
        if process.returncode:
            raise RuntimeError(process.stderr[-400:])
    pages = json.loads(target.read_text())
    text = '\n\n'.join(f'【原卷物理页 {page["page"]}】\n' + '\n'.join(line['text'] for line in page['lines']) for page in pages)
    (output / (identity + '.txt')).write_text(text)
    return {'file': str(target), 'textFile': str(output / (identity + '.txt')), 'pages': len(pages),
            'lowConfidenceLines': sum(line['confidence'] < .8 for page in pages for line in page['lines'])}

targets = [identity for identity, asset in assets.items() if asset['category']=='paper' and asset['name'].lower().endswith('.pdf')]
report = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = {pool.submit(recognize, identity): identity for identity in targets}
    for future in concurrent.futures.as_completed(futures):
        identity = futures[future]
        try: report[identity] = future.result()
        except Exception as error: report[identity] = {'error': str(error)}
        (root / '.local-cet-import/source-ocr-en-index.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        if len(report) % 5 == 0:
            print(json.dumps({'completed': len(report), 'total': len(targets), 'errors': sum('error' in x for x in report.values())}), flush=True)
print(json.dumps({'completed': len(report), 'total': len(targets), 'errors': sum('error' in x for x in report.values())}), flush=True)

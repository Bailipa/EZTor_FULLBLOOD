import hashlib
import json
import subprocess
from pathlib import Path
from pypdf import PdfReader
from docx import Document

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'content/cet-local/index.json').read_text())
output = root / '.local-cet-import/original-text'
output.mkdir(exist_ok=True)
assets = {a['id']: a for i in manifest['items'] for a in i['resources'] if a['category'] in ['paper', 'word', 'answer']}
report = {}
for index, (identity, asset) in enumerate(assets.items(), 1):
    file = root / ('public' + asset['url'])
    target = output / (identity + '.txt')
    try:
        if file.suffix == '.docx':
            document = Document(file)
            lines = []
            for block in document.element.body:
                cells = list(block.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'))
                units = cells or [block]
                lines.extend(''.join(t.text or '' for t in unit.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')) for unit in units)
            text = '\n'.join(lines)
        elif target.exists():
            text = target.read_text()
        elif file.suffix == '.pdf':
            reader = PdfReader(file)
            text = '\n\n'.join(f'【原卷物理页 {n}】\n' + page.extract_text(extraction_mode='layout') for n, page in enumerate(reader.pages, 1))
        else:
            text = subprocess.check_output(['textutil', '-convert', 'txt', '-stdout', str(file)], text=True)
        target.write_text(text)
        letters = sum(c.isascii() and c.isalpha() for c in text)
        report[identity] = {'path': asset['path'], 'file': str(target), 'asciiLetters': letters,
                            'needsOCR': file.suffix == '.pdf' and letters < 500,
                            'textSHA256': hashlib.sha256(text.encode()).hexdigest()}
    except Exception as error:
        report[identity] = {'path': asset['path'], 'error': str(error)}
    if index % 30 == 0:
        print(json.dumps({'processed': index, 'total': len(assets)}), flush=True)
(root / '.local-cet-import/original-text-index.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'files': len(report), 'needsOCR': sum(bool(x.get('needsOCR')) for x in report.values()),
                  'errors': sum('error' in x for x in report.values())}), flush=True)

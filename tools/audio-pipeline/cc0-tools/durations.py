import subprocess, json, glob, collections
out = {}
files = [f.replace(chr(92), '/') for f in glob.glob('**/*', recursive=True) if f.lower().endswith(('.ogg', '.wav', '.flac', '.mp3'))]
for f in sorted(files):
    if f.startswith(('music/', 'ambience/', 'mix/')):
        continue
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True)
    try:
        out[f] = round(float(r.stdout.strip()), 2)
    except ValueError:
        out[f] = None
json.dump(out, open('_tools/durations.json', 'w'), indent=0)
groups = collections.defaultdict(list)
for f, v in out.items():
    k, n = f.rsplit('/', 1)
    groups[k].append(n.rsplit('.', 1)[0] + ':' + str(v))
for k, v in groups.items():
    print('==', k)
    print(' '.join(v))

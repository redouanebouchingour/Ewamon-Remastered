# prints each template row's filled span to check symmetry: python dev/span.py <file> <const-name>
import re,sys
s=open(sys.argv[1],encoding='utf8').read()
name=sys.argv[2]
i=s.index(name)
seg=s[i:i+6000]
m=re.search(r"T\((\d+),\s*\[(.*?)\]\)",seg,re.S)
y0=int(m.group(1))
for k,r in enumerate(re.findall(r"'([^']*)'",m.group(2))):
    f=[j for j,c in enumerate(r) if c not in '. ']
    span=(f[0],f[-1]) if f else None
    sym = '' if not f else ('sym' if f[0]+f[-1]==31 else f'off {f[0]+f[-1]-31:+d}')
    print(f"{y0+k:3d} {len(r):2d} {r} {span} {sym}")

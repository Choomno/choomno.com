"""Independent rational checks of the complete rhombic fundamental polyhedron."""
import json
from fractions import Fraction as F
from pathlib import Path
D=json.loads((Path(__file__).resolve().parents[1]/'rhombic-data.json').read_text())
V=[[F(x) for x in v] for v in D['vertices']]
P=[[F(x) for x in p] for p in D['planes']]
M=[[[F(x) for x in row] for row in m] for m in D['transforms']]
def dot(a,b):return -a[0]*b[0]+sum(x*y for x,y in zip(a[1:],b[1:]))
def mv(m,x):return [sum(a*b for a,b in zip(row,x)) for row in m]
def project(v):return tuple(x/v[0] for x in v)
edges={tuple(sorted(e)) for e in D['edges']}
parent={e:e for e in edges}
def find(e):
 while parent[e]!=e:e=parent[e]
 return e
def union(a,b):parent[find(a)]=find(b)
assert len(V)==14 and len(P)==12 and len(edges)==24
assert sum(D['ideal'])==6
assert len(set(D['vertexClasses'][i] for i in range(14) if D['ideal'][i]))==3
for i,v in enumerate(V):
 assert dot(v,v)==(0 if D['ideal'][i] else F(-1,4))
 assert all(dot(v,p)<=0 for p in P)
 assert sum(dot(v,p)==0 for p in P)==(4 if D['ideal'][i] else 3)
for e in edges:
 assert sum(D['ideal'][j] for j in e)==1
 assert sum(all(dot(V[j],p)==0 for j in e) for p in P)==2
for i,(m,p) in enumerate(zip(M,P)):
 cols=list(zip(*m));j=D['otherFaces'][i]
 assert D['otherFaces'][j]==i
 assert dot(p,p)==1
 assert all(dot(cols[k],cols[l])==((-1 if k==0 else 1) if k==l else 0) for k in range(4) for l in range(4))
 assert mv(m,p)==[-x for x in P[j]]
 assert all(mv(M[j],mv(m,[F(k==l) for k in range(4)]))==[F(k==l) for k in range(4)] for l in range(4))
 image={}
 for k in D['faces'][i]:
  w=mv(m,V[k]);target=[l for l in D['faces'][j] if project(V[l])==project(w)]
  assert len(target)==1
  image[k]=target[0]
  assert D['ideal'][k]==D['ideal'][target[0]]
  if D['ideal'][k]:
   assert w==V[target[0]], 'Cusp horosphere scaling must agree across faces'
   assert D['vertexClasses'][k]==D['vertexClasses'][target[0]]
 for a,b in edges:
  if a in image and b in image:
   mapped=tuple(sorted([image[a],image[b]]))
   assert mapped in edges
   union((a,b),mapped)
orbits={}
for e in edges:orbits.setdefault(find(e),[]).append(e)
assert len(orbits)==6 and all(len(v)==4 for v in orbits.values()), 'Four right wedges must meet around each quotient edge'
# Incident faces are perpendicular: this certifies no angle singularity at finite vertices.
for k,v in enumerate(V):
 if not D['ideal'][k]:
  normals=[p for p in P if dot(v,p)==0]
  assert all(dot(a,b)==0 for i,a in enumerate(normals) for b in normals[i+1:])
print('Exact rhombic checks passed: 12 pairings; 24 edges descend; six ideal vertices form three cusps; right finite dihedral angles.')

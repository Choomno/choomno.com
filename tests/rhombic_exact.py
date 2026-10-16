"""Independent rational checks of the complete rhombic fundamental polyhedron."""
import json
from itertools import permutations
from fractions import Fraction as F
from pathlib import Path
D=json.loads((Path(__file__).resolve().parents[1]/'rhombic-data.json').read_text())
V=[[F(x) for x in v] for v in D['vertices']]
P=[[F(x) for x in p] for p in D['planes']]
M=[[[F(x) for x in row] for row in m] for m in D['transforms']]
def dot(a,b):return -a[0]*b[0]+sum(x*y for x,y in zip(a[1:],b[1:]))
def mv(m,x):return [sum(a*b for a,b in zip(row,x)) for row in m]
def mm(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def determinant(m):
 return sum((-1)**sum(p[i]>p[j] for i in range(4) for j in range(i+1,4))
            *m[0][p[0]]*m[1][p[1]]*m[2][p[2]]*m[3][p[3]] for p in permutations(range(4)))
def project(v):return tuple(x/v[0] for x in v)
identity=[[F(i==j) for j in range(4)] for i in range(4)]
edges={tuple(sorted(e)) for e in D['edges']}
incident={e:[i for i,face in enumerate(D['faces']) if set(e)<=set(face)] for e in edges}
images=[]
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
 assert set(D['faces'][i])=={v for v in range(len(V)) if dot(V[v],p)==0}
 assert determinant(m)==1 and m[0][0]>0, 'Pairings preserve spatial and time orientation'
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
 images.append(image)
 for a,b in edges:
  if a in image and b in image:
   mapped=tuple(sorted([image[a],image[b]]))
   assert mapped in edges
   union((a,b),mapped)
orbits={}
for e in edges:orbits.setdefault(find(e),[]).append(e)
assert len(orbits)==6 and all(len(v)==4 for v in orbits.values()), 'Four right wedges must meet around each quotient edge'
# Four right wedges alone do not check holonomy: traverse every oriented edge
# cycle and require the entire Lorentz transformation to be the identity.
for start_edge in edges:
 for start_face in incident[start_edge]:
  edge,face=start_edge,start_face
  holonomy=identity
  seen=set()
  while (edge,face) not in seen:
   seen.add((edge,face))
   holonomy=mm(M[face],holonomy)
   edge=tuple(sorted(images[face][v] for v in edge))
   entry=D['otherFaces'][face]
   exits=[f for f in incident[edge] if f!=entry]
   assert len(exits)==1
   face=exits[0]
  assert (edge,face)==(start_edge,start_face)
  assert len(seen)==4 and holonomy==identity, 'Nontrivial edge-cycle holonomy'

# Incident faces are perpendicular, so each wedge has angle pi/2.
for k,v in enumerate(V):
 if not D['ideal'][k]:
  normals=[p for p in P if dot(v,p)==0]
  assert all(dot(a,b)==0 for i,a in enumerate(normals) for b in normals[i+1:])

# Compute the vertex links from the actual face maps, without trusting the
# exported class labels. Link faces are original vertices, link sides are
# face/vertex incidences, and link vertices are original edge endpoints.
vertex_parent=list(range(len(V)))
def vertex_root(v):
 while vertex_parent[v]!=v:v=vertex_parent[v]
 return v
for image in images:
 for a,b in image.items():vertex_parent[vertex_root(a)]=vertex_root(b)
classes={}
for v in range(len(V)):classes.setdefault(vertex_root(v),set()).add(v)
assert sorted(len(vs) for vs in classes.values())==[2,2,2,8]
link_counts=[]
for vertices in classes.values():
 assert len({D['vertexClasses'][v] for v in vertices})==1
 ideal={D['ideal'][v] for v in vertices}
 assert len(ideal)==1
 is_ideal=next(iter(ideal))
 sides={(f,v) for v in vertices for f,image in enumerate(images) if v in image}
 side_pairs=set()
 for f,v in sides:
  target=(D['otherFaces'][f],images[f][v])
  assert target in sides and target!=(f,v)
  side_pairs.add(frozenset(((f,v),target)))
 assert len(side_pairs)*2==len(sides), 'Each link side has exactly two incident faces'
 link_vertices={find(e) for e in edges if set(e)&vertices}
 counts=(len(link_vertices),len(side_pairs),len(vertices))
 # Connectivity follows from construction of the vertex classes. Identity
 # four-wedge edge cycles give disk neighborhoods at every link vertex.
 # Orientation-preserving ambient pairings make the closed links orientable.
 # Euler characteristic then identifies a sphere or a torus respectively.
 assert counts==((2,4,2) if is_ideal else (6,12,8))
 assert counts[0]-counts[1]+counts[2]==(0 if is_ideal else 2)
 link_counts.append((is_ideal,counts))
assert sum(ideal for ideal,_ in link_counts)==3
print('Exact rhombic checks passed: 12 orientation-preserving pairings; six identity four-wedge edge cycles; one spherical finite vertex link; three torus cusp links with compatible horospheres.')

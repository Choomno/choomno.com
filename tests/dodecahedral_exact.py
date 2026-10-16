"""Exact algebraic and topological checks of the complete two-cell quotient.

No SnapPy dependency. Face maps select algebraic matrices over Q(sqrt(3),
sqrt(5)); all incidence, metric, holonomy, and cusp checks below are exact.
Float comparisons only confirm that the browser payload evaluates those data.
"""
import json
import sys
from fractions import Fraction as F
from itertools import permutations
from math import isqrt
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from dodecahedral_algebra import (Algebraic as A,canonical_geometry,face_pairing,
                                  lorentz_dot as dot,matvec as mv,matmul as mm,
                                  identity,transpose)
D=json.loads((ROOT/'dodecahedral-data.json').read_text())
G=canonical_geometry();V=G['vertices'];I=identity();cells=D['cells']
assert len(cells)==2

def sign(x):
 """Certify the real sign using rational enclosures of the square roots."""
 x=A(x)
 if x==0:return 0
 denominator=10**50
 low=high=F(0)
 for c,d in zip(x.coefficients,(1,3,5,15)):
  if d==1:l=h=F(1)
  else:
   n=isqrt(d*denominator**2);l,h=F(n,denominator),F(n+1,denominator)
  low+=c*(l if c>=0 else h);high+=c*(h if c>=0 else l)
 assert low>0 or high<0,'Algebraic sign could not be certified'
 return 1 if low>0 else -1

def determinant(m):
 return sum((-1)**sum(p[i]>p[j] for i in range(4) for j in range(i+1,4))
            *m[0][p[0]]*m[1][p[1]]*m[2][p[2]]*m[3][p[3]] for p in permutations(range(4)))

def numeric_payload_matches(exact,numeric):
 if isinstance(exact,(list,tuple)):
  assert len(exact)==len(numeric)
  for a,b in zip(exact,numeric):numeric_payload_matches(a,b)
 else:assert abs(float(exact)-numeric)<3e-13

class UnionFind:
 def __init__(self,items):self.parent={x:x for x in items}
 def root(self,x):
  p=self.parent[x]
  if p!=x:self.parent[x]=self.root(p)
  return self.parent[x]
 def union(self,x,y):self.parent[self.root(x)]=self.root(y)
 def classes(self):
  result={}
  for x in self.parent:result.setdefault(self.root(x),set()).add(x)
  return list(result.values())

P=[];M=[];images=[];edge_sets=[];incident=[]
for cell,domain in enumerate(cells):
 numeric_payload_matches(V,domain['vertices'])
 assert len(domain['faces'])==len(domain['planes'])==len(domain['transforms'])==12
 assert len(domain['otherFaces'])==len(domain['neighbors'])==len(domain['vertexImages'])==12
 edges={tuple(sorted(e)) for e in domain['edges']};assert edges==set(G['edges'])
 edge_sets.append(edges)
 incident.append({e:[f for f,face in enumerate(domain['faces']) if set(e)<=set(face)] for e in edges})
 assert all(len(faces)==2 for faces in incident[-1].values())
 P.append([]);M.append([]);images.append([])
 for f,face in enumerate(domain['faces']):
  assert len(face)==len(set(face))==5
  j=next(j for j,gface in enumerate(G['faces']) if set(face)==set(gface));n=G['normals'][j];P[-1].append(n)
  assert dot(n,n)==1
  assert {v for v in range(20) if dot(n,V[v])==0}==set(face)
  assert all(sign(dot(n,v))<=0 for v in V)
  assert all(tuple(sorted((a,b))) in edges for a,b in zip(face,face[1:]+face[:1]))
  target_cell,other=domain['neighbors'][f],domain['otherFaces'][f]
  assert target_cell in (0,1) and 0<=other<12
  target=cells[target_cell];mapping=dict(zip(face,domain['vertexImages'][f]))
  assert set(mapping.values())==set(target['faces'][other])
  images[-1].append(mapping)
  m=face_pairing(face,target['faces'][other],mapping,G)['matrix'];M[-1].append(m)
  assert determinant(m)==1 and sign(m[0][0])>0
  cols=transpose(m)
  for k in range(4):
   for l in range(4):assert dot(cols[k],cols[l])==((-1 if k==0 else 1) if k==l else 0)
 numeric_payload_matches(P[-1],domain['planes']);numeric_payload_matches(M[-1],domain['transforms'])

edge_items=[(c,*e) for c,edges in enumerate(edge_sets) for e in edges]
vertex_items=[(c,v) for c in range(2) for v in range(20)]
endpoint_items=[(c,*e,v) for c,edges in enumerate(edge_sets) for e in edges for v in e]
edge_classes=UnionFind(edge_items);vertex_classes=UnionFind(vertex_items);endpoint_classes=UnionFind(endpoint_items)
for c,domain in enumerate(cells):
 for f,m in enumerate(M[c]):
  other,target=domain['otherFaces'][f],domain['neighbors'][f]
  assert cells[target]['neighbors'][other]==c and cells[target]['otherFaces'][other]==f
  assert mm(M[target][other],m)==I
  assert mv(m,P[c][f])==[-x for x in P[target][other]]
  for v,w in images[c][f].items():
   assert images[target][other][w]==v
   assert mv(m,V[v])==V[w], 'Cusp horospheres need identical null-vector scaling'
   vertex_classes.union((c,v),(target,w))
  for e in edge_sets[c]:
   if set(e)<=set(images[c][f]):
    image=tuple(sorted(images[c][f][v] for v in e));assert image in edge_sets[target]
    edge_classes.union((c,*e),(target,*image))
    for v in e:endpoint_classes.union((c,*e,v),(target,*image,images[c][f][v]))
 for e in edge_sets[c]:
  a,b=incident[c][e]
  assert dot(P[c][a],P[c][b])==F(-1,2), 'Each wedge has angle pi/3'
assert len(edge_classes.classes())==10 and all(len(x)==6 for x in edge_classes.classes())
# Tracking the side of each edge prevents treating a nontrivial screw motion
# along an edge as an identity cycle just because its combinatorics closes.
for c,e0,e1 in edge_items:
 edge=(e0,e1)
 for face in incident[c][edge]:
  start=(c,edge,face);state=start;seen=set();holonomy=I
  while state not in seen:
   seen.add(state);cell,e,f=state;domain=cells[cell]
   holonomy=mm(M[cell][f],holonomy)
   image=tuple(sorted(images[cell][f][v] for v in e));target=domain['neighbors'][f];entry=domain['otherFaces'][f]
   exits=[g for g in incident[target][image] if g!=entry];assert len(exits)==1
   state=(target,image,exits[0])
  assert state==start and len(seen)==6 and holonomy==I

# The ideal links consist of 40 equilateral Euclidean triangles. Opposite
# sides glue in pairs, and six triangles meet at every link vertex. All
# null-vector scalings agree, so these closed links carry a complete flat
# metric. Connectivity + orientability + chi=0 identify a single torus cusp.
assert len(vertex_classes.classes())==1 and len(vertex_classes.classes()[0])==40
sides={(c,f,v) for c,d in enumerate(cells) for f,image in enumerate(images[c]) for v in image}
side_pairs=set()
for c,f,v in sides:
 target=(cells[c]['neighbors'][f],cells[c]['otherFaces'][f],images[c][f][v])
 assert target in sides and target!=(c,f,v)
 side_pairs.add(frozenset(((c,f,v),target)))
assert len(sides)==120 and len(side_pairs)==60
assert len(endpoint_classes.classes())==20 and all(len(x)==6 for x in endpoint_classes.classes())
assert 20-60+40==0
# Every ideal vertex really has an equilateral triangular horospherical link:
# the same pi/3 angle lies between each pair of its three incident faces.
for c,domain in enumerate(cells):
 for v in range(20):
  face_indices=[f for f,image in enumerate(images[c]) if v in image]
  assert len(face_indices)==3
  assert all(dot(P[c][a],P[c][b])==F(-1,2) for a in face_indices for b in face_indices if a!=b)
print('Exact dodecahedral checks passed over Q(sqrt(3),sqrt(5)): 24 orientation-preserving face pairings; ten identity six-wedge edge cycles; one complete torus cusp with 40 triangular faces, 60 sides, 20 vertices; browser payload agrees with algebraic data.')

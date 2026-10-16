"""Export the complete L6a4 rhombic cell with exact rational certificates.

Requires snappy==3.3.2. Pairing data comes from SnapPy, GPL-2.0-or-later;
https://github.com/3-manifolds/SnapPy . No SnapPy renderer code is copied.
"""
import snappy,json,math,argparse
from fractions import Fraction
from pathlib import Path
manifold=snappy.ManifoldHP('L6a4')
D=manifold.dirichlet_domain()
assert D.manifold().isometry_signature()==manifold.isometry_signature(), 'Reconstructed quotient differs from L6a4'
assert D.num_finite_vertices()==8 and D.num_ideal_vertices()==6
assert D.num_edges()==24 and D.num_faces()==12
def dot(a,b):return -a[0]*b[0]+sum(x*y for x,y in zip(a[1:],b[1:]))
def mv(m,x):return [sum(a*b for a,b in zip(row,x)) for row in m]
def mm(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def inv(m):return [[m[j][i]*(-1 if (i==0)!=(j==0) else 1) for j in range(4)] for i in range(4)]
V=D.vertex_list(details=True); verts=[[1.]+[float(x) for x in v['position']] for v in V]
axes=[]
for v in V:
 if not v['ideal']:continue
 p=[float(x) for x in v['position']]
 if all(abs(sum(a*b for a,b in zip(p,q)))<1e-8 for q in axes):axes.append(p)
 if len(axes)==3:break
R=[[1.,0,0,0]]+[[0.]+p for p in axes]
verts=[mv(R,p) for p in verts]
rounding_residual=0.
def lattice_value(x,denominator):
 global rounding_residual
 candidate=round(x*denominator)/denominator
 residual=abs(x-candidate)
 assert residual<1e-10, ('Unsupported coordinate: not on expected rational lattice',x,denominator,residual)
 rounding_residual=max(rounding_residual,residual)
 return candidate
verts=[[lattice_value(x,2) for x in p] for p in verts]
M=[mm(mm(R,[[float(x) for x in row] for row in m]),inv(R)) for m in D.pairing_matrices()]
M=[[[lattice_value(x,1) for x in row] for row in m] for m in M]
F=D.face_list(); planes=[]; transforms=[]; paired=[]
for i,f in enumerate(F):
 p=mv(R,[1.]+[float(x) for x in f['closest']]); normal=[-1.]+[0.,0.,0.]
 # normal from closest point on plane, normalized unit spacelike
 q=p[1:]; norm=math.sqrt(sum(x*x for x in q)); n=[norm/math.sqrt(1-norm*norm)]+[x/norm/math.sqrt(1-norm*norm) for x in q]
 n=[lattice_value(x,1) for x in n];planes.append(n)
 # Pairing convention determined by comparing face images.
 options=[]
 for m in [M[i],inv(M[i])]:
  image=[mv(m,verts[j]) for j in f['vertex_indices']]
  image=[[x/p[0] for x in p] for p in image]
  err=max(min(max(abs(x-y) for x,y in zip(p,verts[j])) for j in f['vertex_image_indices']) for p in image)
  options.append((err,m))
 err,m=min(options,key=lambda a:a[0]);assert err<1e-8,err
 transforms.append(m)
for i,m in enumerate(transforms):
 n=mv(m,planes[i]);j=min(range(12),key=lambda j:max(abs(x+y) for x,y in zip(n,planes[j])))
 assert max(abs(x+y) for x,y in zip(n,planes[j]))<1e-8
 paired.append(j)
O=dict(vertices=verts,ideal=[v['ideal'] for v in V],vertexClasses=[v['vertex_class'] for v in V],planes=planes,transforms=transforms,otherFaces=paired,faces=[f['vertex_indices'] for f in F],edges=[[e['tail_vertex_index'],e['tip_vertex_index']] for e in D.edge_list()],provenance='SnapPy ManifoldHP L6a4 Dirichlet domain, conjugated by orthogonal axes from ideal vertices; integer and half-integer coordinates rounded after residual <1e-8')
# Certify the rationalized data, independently of high precision recognition.
Q=lambda x: Fraction(x)
qverts=[[Q(x) for x in v] for v in verts]
qplanes=[[Q(x) for x in v] for v in planes]
qtransforms=[[[Q(x) for x in row] for row in m] for m in transforms]
for i,m in enumerate(qtransforms):
 m=[[Q(x) for x in row] for row in m]
 cols=list(zip(*m));j=paired[i]
 assert all(dot(cols[k],cols[l])==((-1 if k==0 else 1) if k==l else 0) for k in range(4) for l in range(4))
 assert mv(m,qplanes[i])==[-x for x in qplanes[j]]
 assert all(mv(qtransforms[j],mv(m,[Q(k==l) for k in range(4)]))==[Q(k==l) for k in range(4)] for l in range(4))
 for k in O['faces'][i]:
  w=mv(m,qverts[k]);w=[x/w[0] for x in w]
  assert w in [qverts[l] for l in O['faces'][j]]
O['provenance']={
 'manifold':'L6a4','generator':'SnapPy '+snappy.__version__+' ManifoldHP.dirichlet_domain',
 'source':'https://github.com/3-manifolds/SnapPy','sourceLicense':'GPL-2.0-or-later',
 'description':'Complete Borromean rings complement; 12 rhombic faces, 24 finite-to-ideal edges',
 'coordinates':'Lorentz -+++; row-major matrices acting on columns; vertices are homogeneous Klein coordinates',
 'maxRecognitionResidual':rounding_residual,
 'recognition':'Vertices recognized as half-integers; normals and pairings as integers, only after residual <1e-10; exact checks follow.',
 'isometrySignature':manifold.isometry_signature(),
 'quotientReconstructionVerified':True,
 'volume':float(D.volume())}
O['exactCertificate']={
 'field':'Q','pairings':12,'faceVertexImages':48,
 'checks':['Lorentz form preserved','paired outward normals reversed','paired transformations inverse','face vertices mapped to paired faces'],
 'note':'These are exact rational checks of a domain exported from the complete SnapPy L6a4 structure. They do not certify floating point pixels.'}
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'rhombic-data.json')
path=parser.parse_args().output
path.write_text(json.dumps(O,indent=2)+'\n')
print(json.dumps({'output':str(path),'provenance':O['provenance'],'exactCertificate':O['exactCertificate']},indent=2))

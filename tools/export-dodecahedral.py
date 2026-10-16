"""Export the regular ideal dodecahedra of SnapPy odode02_00913.

Requires SnapPy 3.3.2. Develops canonical tetrahedra across transparent
(zero-tilt) faces, then merges coplanar boundary triangles into pentagons.
"""
import argparse,itertools,json,math
from pathlib import Path
import snappy
from snappy.raytracing.ideal_raytracing_data import IdealRaytracingData
from snappy.geometric_structure.cusp_neighborhood.real_cusp_cross_section import RealCuspCrossSection
import dodecahedral_algebra as exact
from dodecahedral_reconstruction import reconstruct_signature

def dot(a,b):return -a[0]*b[0]+sum(x*y for x,y in zip(a[1:],b[1:]))
def mv(a,x):return [sum(v*w for v,w in zip(row,x)) for row in a]
def mm(a,b):return [[sum(x*y for x,y in zip(row,col)) for col in zip(*b)] for row in a]
def inv(a):return [[a[j][i]*(-1 if (i==0)!=(j==0) else 1) for j in range(4)] for i in range(4)]
def identity():return [[float(i==j) for j in range(4)] for i in range(4)]
def err(a,b):return max(abs(x-y) for x,y in zip(a,b))
def norm(v):return [x/v[0] for x in v]
def invert(a):
 n=len(a); rows=[list(r)+[float(i==j) for j in range(n)] for i,r in enumerate(a)]
 for i in range(n):
  j=max(range(i,n),key=lambda j:abs(rows[j][i])); rows[i],rows[j]=rows[j],rows[i]
  assert abs(rows[i][i])>1e-10
  s=rows[i][i];rows[i]=[x/s for x in rows[i]]
  for j in range(n):
   if i==j:continue
   s=rows[j][i];rows[j]=[x-s*y for x,y in zip(rows[j],rows[i])]
 return [r[n:] for r in rows]
def boost(p):
 # Proper Lorentz transformation taking center p to e0.
 a=identity(); a[0]=[p[0]]+[-x for x in p[1:]]
 for i in range(1,4):
  a[i][0]=-p[i]
  for j in range(1,4):a[i][j]=float(i==j)+p[i]*p[j]/(1+p[0])
 return a

def main(path):
 m=snappy.ManifoldHP('odode02_00913');original_signature=m.isometry_signature()
 m.canonize();assert m.solution_type()=='all tetrahedra positively oriented'
 cross=RealCuspCrossSection.fromManifoldAndShapes(m,m.tetrahedra_shapes('rect'))
 cross.compute_tilts();tilts=cross.read_tilts(); opaque=[float(t)<-1e-20 for t in tilts]
 assert all(float(t)<-1e-20 or abs(float(t))<1e-40 for t in tilts)
 ray=IdealRaytracingData.from_manifold(m);bindings=ray.get_uniform_bindings()
 raw=lambda key:bindings[key][1]
 vec=lambda v:[float(x) for x in v]
 mats=[list(map(vec,a)) for a in raw('TetrahedraBasics.SO13tsfms')]
 planes=list(map(vec,raw('TetrahedraBasics.planes')))
 vertices=list(map(vec,raw('TetrahedraBasics.R13Vertices')))
 neighbors=list(map(int,raw('TetrahedraCombinatorics.otherTetNums')))
 otherfaces=list(map(int,raw('TetrahedraCombinatorics.otherFaceNums')))
 # Each D[t] takes tetrahedron-local coordinates to its canonical-cell frame.
 D={};components=[];tetcell={};development_error=0.
 for seed in range(m.num_tetrahedra()):
  if seed in D:continue
  D[seed]=identity();component=[];queue=[seed]
  while queue:
   t=queue.pop(0);component.append(t);tetcell[t]=len(components)
   for f in range(4):
    i=4*t+f
    if opaque[i]:continue
    u=neighbors[i];a=mm(D[t],inv(mats[i]))
    if u in D:
     development_error=max(development_error,err(sum(a,[]),sum(D[u],[])))
    else:D[u]=a;queue.append(u)
  components.append(component)
 assert len(components)==2,components
 phi=(1+math.sqrt(5))/2
 canonical=[[1.]+[x/math.sqrt(3) for x in p] for p in itertools.product([-1.,1.],repeat=3)]
 for zero in range(3):
  for a,b in itertools.product([-1.,1.],repeat=2):
   p=[0.,a/phi,b*phi];p=p[-zero:]+p[:-zero] if zero else p
   canonical.append([1.]+[x/math.sqrt(3) for x in p])
 edge2=min(sum((u[i]-v[i])**2 for i in range(1,4)) for u,v in itertools.combinations(canonical,2))
 standard_edges=[[a,b] for a,b in itertools.combinations(range(20),2) if abs(sum((canonical[a][i]-canonical[b][i])**2 for i in range(1,4))-edge2)<1e-8]
 assert len(standard_edges)==30
 cells=[];frames=[];boundary_maps=[];recognition_error=0.
 for component in components:
  merged=[]
  for t in component:
   for f in range(4):
    i=4*t+f
    if not opaque[i]:continue
    n=mv(D[t],planes[i]); found=next((q for q in merged if err(q['normal'],n)<1e-7),None)
    if found is None:found={'normal':n,'corners':[]};merged.append(found)
    found['corners'].append(i)
  assert len(merged)==12,[len(c) for c in components]
  # Equal distance to all twelve unit face planes determines the cell center.
  for triple in itertools.combinations(range(1,12),3):
   a=[[merged[j]['normal'][i]-merged[0]['normal'][i] for i in range(1,4)] for j in triple]
   try:ainv=invert(a)
   except AssertionError:continue
   b=[merged[j]['normal'][0]-merged[0]['normal'][0] for j in triple]
   p=[1.]+mv(ainv,b);break
  p=[x/math.sqrt(-dot(p,p)) for x in p];B=boost(p)
  developed=[]
  for t in component:
   for v in range(4):
    p=norm(mv(mm(B,D[t]),vertices[4*t+v]))
    if not any(err(p,q)<1e-7 for q in developed):developed.append(p)
  assert len(developed)==20,len(developed)
  # Align an ordered length-two edge fan with the standard dodecahedron.
  source0=developed[0];neighborverts=[p for p in developed if abs(sum((p[i]-source0[i])**2 for i in range(1,4))-edge2)<1e-7]
  assert len(neighborverts)==3
  sbasis=list(map(list,zip(source0[1:],neighborverts[0][1:],neighborverts[1][1:])))
  sourceinv=invert(sbasis)
  target0=canonical[0];targetneighbors=[p for p in canonical if abs(sum((p[i]-target0[i])**2 for i in range(1,4))-edge2)<1e-7]
  for t1,t2 in itertools.permutations(targetneighbors,2):
   tbasis=list(map(list,zip(target0[1:],t1[1:],t2[1:])))
   r=mm(tbasis,sourceinv)
   determinant=r[0][0]*(r[1][1]*r[2][2]-r[1][2]*r[2][1])-r[0][1]*(r[1][0]*r[2][2]-r[1][2]*r[2][0])+r[0][2]*(r[1][0]*r[2][1]-r[1][1]*r[2][0])
   if determinant>0:break
  R=[[1.,0.,0.,0.]]+[[0.]+row for row in r];C=mm(R,B);frames.append(C)
  for p in developed:recognition_error=max(recognition_error,min(err(mv(R,p),q) for q in canonical))
  cell={'vertices':canonical,'planes':[],'edges':standard_edges,'faces':[],'transforms':[],'otherFaces':[],'neighbors':[],'vertexImages':[]}
  corner_to_face={}
  for f,q in enumerate(merged):
   n=mv(C,q['normal']);cell['planes'].append(n)
   ids=[v for v,p in enumerate(canonical) if abs(dot(n,p))<1e-7]
   assert len(ids)==5,(f,ids)
   # Sort cyclically by adjacency rather than polar angle.
   ordered=[min(ids)];last=-1
   while len(ordered)<5:
    choices=[v for v in ids if v not in ordered and sorted([v,ordered[-1]]) in standard_edges]
    assert choices
    ordered.append(min(choices))
   cell['faces'].append(ordered)
   for i in q['corners']:corner_to_face[i]=f
  cells.append(cell);boundary_maps.append((corner_to_face,merged))
 pairing_error=0.
 for c,cell in enumerate(cells):
  for f,q in enumerate(boundary_maps[c][1]):
   candidates=[]
   for i in q['corners']:
    t=i//4;u=neighbors[i];dest=tetcell[u];j=4*u+otherfaces[i];g=boundary_maps[dest][0][j]
    a=mm(mm(mm(mm(frames[dest],D[u]),mats[i]),inv(D[t])),inv(frames[c]))
    candidates.append((dest,g,a))
   dest,g,a=candidates[0]
   for d,h,b in candidates:
    assert (d,h)==(dest,g)
    pairing_error=max(pairing_error,err(sum(a,[]),sum(b,[])))
   cell['neighbors'].append(dest);cell['otherFaces'].append(g);cell['transforms'].append(a)
   vertex_map=[]
   for v in cell['faces'][f]:
    p=norm(mv(a,canonical[v]));match=min(range(20),key=lambda k:err(p,canonical[k]));assert match in cells[dest]['faces'][g]
    recognition_error=max(recognition_error,err(p,canonical[match]));vertex_map.append(match)
   cell['vertexImages'].append(vertex_map)
 # The development identifies combinatorics only. Reconstruct every metric
 # object over Q(sqrt(3),sqrt(5)), then evaluate for the renderer.
 geometry=exact.canonical_geometry();exactcells=[];exact_error=0.
 for c,cell in enumerate(cells):
  qplanes=[geometry['normals'][next(i for i,g in enumerate(geometry['faces']) if set(f)==set(g))] for f in cell['faces']]
  qtransforms=[]
  for f,source in enumerate(cell['faces']):
   target=cells[cell['neighbors'][f]]['faces'][cell['otherFaces'][f]]
   result=exact.face_pairing(source,target,dict(zip(source,cell['vertexImages'][f])),geometry)
   qtransforms.append(result['matrix'])
  exact_error=max(exact_error,err(sum(cell['planes'],[]),sum(exact.to_float(qplanes),[])))
  exact_error=max(exact_error,err(sum(sum(cell['transforms'],[]),[]),sum(sum(exact.to_float(qtransforms),[]),[])))
  cell['vertices']=exact.to_float(geometry['vertices'])
  cell['planes']=exact.to_float(qplanes);cell['transforms']=exact.to_float(qtransforms)
  exactcells.append({'planes':qplanes,'transforms':qtransforms})
 for c,cell in enumerate(cells):
  for f,matrix in enumerate(exactcells[c]['transforms']):
   d,g=cell['neighbors'][f],cell['otherFaces'][f]
   assert exact.matmul(exactcells[d]['transforms'][g],matrix)==exact.identity()
   assert exact.matvec(matrix,exactcells[c]['planes'][f])==[-x for x in exactcells[d]['planes'][g]]
 output={'cells':cells,'provenance':{'manifold':'odode02_00913','description':'Aitchison–Rubinstein dodecahedral knot complement; two regular ideal dodecahedra','generator':'SnapPy '+snappy.__version__+' ManifoldHP, canonical tilts and tetrahedron development','source':'https://github.com/3-manifolds/SnapPy','sourceLicense':'GPL-2.0-or-later','coordinates':'Lorentz -+++; row-major matrices acting on columns; homogeneous Klein vertices','volume':float(m.volume()),'cusps':m.num_cusps(),'isometrySignature':original_signature,'canonicalTriangulationSignature':m.triangulation_isosig(),'canonicalTetrahedra':m.num_tetrahedra()},'verification':{'maxDevelopmentError':development_error,'maxRecognitionError':recognition_error,'maxMergedPairingError':pairing_error,'maxExactReconstructionError':exact_error}}
 reconstructed_signature=reconstruct_signature(cells)
 assert reconstructed_signature==original_signature, (reconstructed_signature,original_signature)
 output['provenance']['reconstructedCanonicalSignature']=reconstructed_signature
 output['provenance']['quotientReconstructionVerified']=True
 output['exactCertificate']={'field':'Q(sqrt(3),sqrt(5))','basis':['1','sqrt(3)','sqrt(5)','sqrt(15)'],'encoding':'Each scalar is an ordered list of four rational coefficients in the stated basis.','vertices':exact.serialize(geometry['vertices']),'cells':exact.serialize(exactcells),'checks':['Null vertices','Unit spacelike normals','Regular pentagonal faces','Dihedral angles pi/3','Exact face vertex images','Lorentz pairing isometries','Inverse face pairings','Reversed paired outward normals'],'construction':'Each pairing is a canonical dodecahedral symmetry followed by reflection in its target face; matrices are constructed algebraically from the recovered vertex permutations.'}
 assert max(output['verification'].values())<1e-8,output['verification']
 path.write_text(json.dumps(output,indent=2)+'\n');print(json.dumps({'output':str(path),'verification':output['verification'],'cellTetrahedra':list(map(len,components))},indent=2))

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'dodecahedral-data.json');main(p.parse_args().output)

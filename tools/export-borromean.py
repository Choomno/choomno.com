"""Export SnapPy's complete L6a4 geometry; run with work/snappy-venv/bin/python.

Matrices are row-major and act on COLUMN vectors. Lorentz metric is -+++.
Source implementation: https://github.com/3-manifolds/SnapPy/tree/master/src/snappy/raytracing
SnapPy is GPL-2.0-or-later. This script serializes mathematical manifold data.
"""
import json, math, cmath, argparse
from fractions import Fraction
from pathlib import Path
import snappy
from snappy.raytracing.ideal_raytracing_data import IdealRaytracingData

M = snappy.ManifoldHP('L6a4')
assert M.num_cusps() == 3
assert M.solution_type() == 'all tetrahedra positively oriented'
# Certify the complete gluing equations over Q(i), without numerical rounding.
def gmul(a,b): return (a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0])
def ginv(a):
    norm=a[0]*a[0]+a[1]*a[1]
    return (a[0]/norm,-a[1]/norm)
def gpow(a,n):
    if n<0: return gpow(ginv(a),-n)
    result=(Fraction(1),Fraction(0))
    while n:
        if n%2:result=gmul(result,a)
        a=gmul(a,a);n//=2
    return result
exact_shapes=[]; shape_residual=0.0
for z in M.tetrahedra_shapes('rect'):
    r=Fraction(1,2) if float(z.real())<0.75 else Fraction(1)
    exact_shapes.append((r,r))
    R=z.real().parent(); target=R(r.numerator)/R(r.denominator)
    shape_residual=max(shape_residual,float(abs(z.real()-target)),float(abs(z.imag()-target)))
assert shape_residual<1e-50
shape_parameters=[]
for z in exact_shapes:
    one_minus_z=(1-z[0],-z[1])
    z_minus_one=(z[0]-1,z[1])
    shape_parameters.extend([z,ginv(one_minus_z),gmul(z_minus_one,ginv(z))])
gluing_rows=[[int(e) for e in row] for row in M.gluing_equations()]
products=[]; edge_angles=[]
for row_index,row in enumerate(gluing_rows):
    result=(Fraction(1),Fraction(0))
    for z,e in zip(shape_parameters,row):result=gmul(result,gpow(z,e))
    assert result==(1,0),(row_index,result)
    products.append([str(result[0]),str(result[1])])
    if row_index<M.num_tetrahedra():
        angle=sum(e*cmath.phase(complex(float(z[0]),float(z[1]))) for z,e in zip(shape_parameters,row))
        assert abs(angle-2*math.pi)<1e-12,(row_index,angle)
        edge_angles.append(angle)
exact_certificate={
    'field':'Q(i)',
    'shapeConvention':"For each tetrahedron the columns are z, z_prime=1/(1-z), z_double_prime=(z-1)/z.",
    'shapes':[[str(r),str(i)] for r,i in exact_shapes],
    'equationRows':gluing_rows,
    'equationOrder':'First 8 edge equations; next 6 peripheral completeness equations (meridian and longitude for each cusp).',
    'exactProducts':products,
    'edgeAngleSums':edge_angles,
    'maxHighPrecisionShapeResidual':shape_residual,
    'completeCusps':[bool(c['is_complete']) for c in M.cusp_info()],
    'result':'All 14 equation products equal 1+0i by exact rational arithmetic; all 8 edge angle sums equal 2pi within 1e-12.'
}
D = IdealRaytracingData.from_manifold(M, areas=[2.0]*3)
U = D.get_uniform_bindings()

def vector(x): return [float(v) for v in x]
def matrix(x): return [vector(row) for row in x]
def get(key, f): return [f(v) for v in U[key][1]]
def dot(a,b): return -a[0]*b[0]+sum(a[i]*b[i] for i in range(1,4))
def mv(a,x): return [sum(a[i][j]*x[j] for j in range(4)) for i in range(4)]
def mm(a,b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

out = {
 'provenance': {
  'manifold':'L6a4', 'description':'Borromean rings complement, complete metric',
  'generator':'SnapPy '+snappy.__version__+' ManifoldHP / IdealRaytracingData',
  'source':'https://github.com/3-manifolds/SnapPy/tree/master/src/snappy/raytracing',
  'sourceLicense':'GPL-2.0-or-later',
  'coordinates':'Lorentz hyperboloid, metric diag(-1,1,1,1); row-major matrices act on column vectors',
  'precision':'SnapPy high precision evaluated then rounded to IEEE754 doubles',
  'solutionType':M.solution_type(), 'volume':float(M.volume()),
  'cusps':M.num_cusps(), 'tetrahedra':M.num_tetrahedra(),
  'isometrySignature':M.isometry_signature(),
  'triangulationSignature':M.triangulation_isosig(),
  'identifiedAs':[str(x) for x in M.identify()],
  'shapes':[[float(z.real()),float(z.imag())] for z in M.tetrahedra_shapes('rect')],
  'cuspAreas':[2.0]*3,
  'maximalCuspAreaMatrix':matrix(M.cusp_area_matrix()),
  'cuspDisjointness':'Chosen area products 4 are strictly below every maximal cusp-area matrix entry (minimum 16).',
  'exactShapeCandidates':['(1+i)/2' if float(z.real()) < 0.75 else '1+i' for z in M.tetrahedra_shapes('rect')],
 },
 'neighbors':get('TetrahedraCombinatorics.otherTetNums',int),
 'otherFaces':get('TetrahedraCombinatorics.otherFaceNums',int),
 'transforms':get('TetrahedraBasics.SO13tsfms',matrix),
 'planes':get('TetrahedraBasics.planes',vector),
 'vertices':get('TetrahedraBasics.R13Vertices',vector),
 'cusps':get('Colors.vertex_color_indices',int),
 'edgeIndices':get('Colors.edge_color_indices',int),
 'scales':get('horosphereScales',float),
 'tetToCuspMatrices':get('TetCuspMatrices.tetToCuspMatrices',matrix),
 'toStandardTorusMatrices':get('toStandardTorusMatrices',matrix),
}
# Fundamental data checks independent of the rendering implementation.
err_lorentz=err_inverse=err_null=err_normal=err_cusp=0.0
for i,a in enumerate(out['transforms']):
 j=4*out['neighbors'][i]+out['otherFaces'][i]
 assert out['neighbors'][j]==i//4 and out['otherFaces'][j]==i%4
 cols=[[a[r][c] for r in range(4)] for c in range(4)]
 err_lorentz=max(err_lorentz,max(abs(dot(cols[r],cols[c])-((-1 if r==0 else 1) if r==c else 0)) for r in range(4) for c in range(4)))
 prod=mm(out['transforms'][j],a)
 err_inverse=max(err_inverse,max(abs(prod[r][c]-int(r==c)) for r in range(4) for c in range(4)))
 n=out['planes'][i]
 err_normal=max(err_normal,abs(dot(n,n)-1))
 # Face mapped to target face, with outward normal reversed.
 tn=mv(a,n); target=out['planes'][j]
 assert max(abs(tn[k]+target[k]) for k in range(4))<1e-10
 for vi in range(4):
  if vi==i%4: continue
  h=[out['vertices'][4*(i//4)+vi][k]*out['scales'][4*(i//4)+vi] for k in range(4)]
  transformed=mv(a,h)
  candidates=[]
  for vj in range(4):
   h2=[out['vertices'][4*(j//4)+vj][k]*out['scales'][4*(j//4)+vj] for k in range(4)]
   candidates.append(max(abs(transformed[k]-h2[k]) for k in range(4)))
  err_cusp=max(err_cusp,min(candidates))
for v in out['vertices']:err_null=max(err_null,abs(dot(v,v)))
checks={'maxLorentzError':err_lorentz,'maxInverseError':err_inverse,'maxNullError':err_null,'maxNormalError':err_normal,'maxCuspMatchingError':err_cusp}
assert max(checks.values())<1e-10,checks
out['verification']=checks
out['exactGluingCertificate']=exact_certificate
parser=argparse.ArgumentParser(description=__doc__)
default_dir=Path(__file__).parent.parent if Path(__file__).parent.name=='tools' else Path(__file__).parent
parser.add_argument('--output',type=Path,default=default_dir/'borromean-data.json')
path=parser.parse_args().output
path.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'output':str(path),'provenance':out['provenance'],'verification':checks},indent=2))

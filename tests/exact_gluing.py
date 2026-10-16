"""Independently verify the exported Gaussian-rational gluing certificate."""
from fractions import Fraction as F
from pathlib import Path
import json, cmath, math
D=json.loads((Path(__file__).resolve().parent.parent/'borromean-data.json').read_text())
C=D['exactGluingCertificate']
def mul(a,b):return(a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0])
def inv(a):
 n=a[0]*a[0]+a[1]*a[1]
 return(a[0]/n,-a[1]/n)
def power(a,n):
 if n<0:return power(inv(a),-n)
 p=(F(1),F(0))
 for _ in range(n):p=mul(p,a)
 return p
parameters=[]
assert len(C['shapes'])==8
for pair in C['shapes']:
 z=tuple(map(F,pair));assert z in [(F(1),F(1)),(F(1,2),F(1,2))]
 parameters.extend([z,inv((1-z[0],-z[1])),mul((z[0]-1,z[1]),inv(z))])
rows=C['equationRows'];assert len(rows)==14
for k,row in enumerate(rows):
 assert len(row)==24
 result=(F(1),F(0))
 for z,e in zip(parameters,row):result=mul(result,power(z,e))
 assert result==(1,0),(k,result)
 if k<8:
  theta=sum(e*cmath.phase(complex(float(z[0]),float(z[1]))) for z,e in zip(parameters,row))
  assert abs(theta-2*math.pi)<1e-12,(k,theta)
assert C['completeCusps']==[True]*3
assert C['maxHighPrecisionShapeResidual']<1e-50
areas=D['provenance']['cuspAreas'];bounds=D['provenance']['maximalCuspAreaMatrix']
assert all(areas[i]*areas[j]<bounds[i][j] for i in range(3) for j in range(3))
print('Exact Q(i) certificate passed: 8 edge equations with angle sum 2pi; 6 peripheral completeness equations; 3 disjoint cusps.')

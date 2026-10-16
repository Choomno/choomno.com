"""Independent 90-digit hyperbolic tube identities and float64 error audit.

Standard library only. This does not render or change any production shader.
"""
from decimal import Decimal as Q, getcontext
import ctypes
import ctypes.util
import json
import math
from pathlib import Path
import random

getcontext().prec = 90
rng = random.Random(20261016)
libm = ctypes.CDLL(ctypes.util.find_library('m'))
libm.fma.argtypes = [ctypes.c_double] * 3
libm.fma.restype = ctypes.c_double
fma = libm.fma

def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), Q(0))

def ld(a, b):
    return dot(a[1:], b[1:]) - a[0]*b[0]

def lin(a, x, b, y):
    return [a*v+b*w for v,w in zip(x,y)]

def unit(n):
    x=[Q(rng.randrange(-1000000,1000001)) for _ in range(n)]
    r=dot(x,x).sqrt()
    return [v/r for v in x]

def cs(t):
    e=t.exp()
    return (e+1/e)/2,(e-1/e)/2

def boost(v, k, c, s):
    w=dot(k,v[1:])
    return [c*v[0]+s*w]+[x+ki*((c-1)*w+s*v[0]) for x,ki in zip(v[1:],k)]

def diff_products(a,b,c,d):
    w=c*d
    return fma(a,b,-w)+fma(-c,d,w)

def h_values(P,D,s2):
    a=sum(v*v for v in D)+s2
    B=sum(x*y for x,y in zip(P,D))
    c=sum(v*v for v in P)-s2
    u=[d-p for p,d in zip(P,D)]
    v=[d+p for p,d in zip(P,D)]
    A=sum(x*y for x,y in zip(u,v))+s2
    det=P[0]*D[1]-P[1]*D[0]
    comp=diff_products(P[0],D[1],P[1],D[0])
    return {
        'naive':B*B-a*c,
        'factored':s2*A-det*det,
        'factored_compensated_det':fma(-comp,comp,s2*A),
    }

def stats(values):
    values=sorted(values)
    return {'median':values[len(values)//2], 'p95':values[int(.95*(len(values)-1))], 'max':values[-1]}

errors={}
identity_errors=[]
geometric_facing_errors=[]
invariants=[]
counts={}
samples=[]
for i in range(900):
    # A point X on a radius-asinh(s) tube about the t/z geodesic.
    s=Q('0.025') if i%2 else Q(str(10**rng.uniform(-3,-.7)))
    s2=s*s
    C=(1+s2).sqrt()
    e=unit(2)
    z=Q(str(rng.uniform(-4,4)))
    cz,sz=cs(z)
    X=[C*cz,s*e[0],s*e[1],C*sz]
    T=[Q(0),s*e[0],s*e[1],Q(0)]
    N=[(a+s2*b)/(s*C) for a,b in zip(T,X)]
    Et=[Q(0),-e[1],e[0],Q(0)]
    Ez=[sz,Q(0),Q(0),cz]
    angle=unit(2)
    eta=-Q(str(10**rng.uniform(-7,0))) if i%3==0 else -Q(str(rng.uniform(.03,1)))
    V=lin(eta,N,(1-eta*eta).sqrt(),lin(angle[0],Et,angle[1],Ez))
    # X is reached at positive distance t by the oriented ray (p,d).
    t=Q(str(rng.uniform(.001,12)))
    ct,st=cs(t)
    p=lin(ct,X,-st,V)
    d=lin(-st,X,ct,V)
    n1=[Q(0),Q(1),Q(0),Q(0)]
    n2=[Q(0),Q(0),Q(1),Q(0)]
    # Random Lorentz transformation varies both the ray and tube plane.
    axis=unit(3)
    cb,sb=cs(Q(str(rng.uniform(-4,4))))
    p,d,n1,n2=[boost(v,axis,cb,sb) for v in (p,d,n1,n2)]
    P=[ld(p,n1),ld(p,n2)]
    D=[ld(d,n1),ld(d,n2)]
    a=dot(D,D)+s2
    B=dot(P,D)
    c=dot(P,P)-s2
    h=B*B-a*c
    h_alt=s2*(dot(lin(1,D,-1,P),lin(1,D,1,P))+s2)-(P[0]*D[1]-P[1]*D[0])**2
    true_h=s2*(1+s2)*eta*eta
    identity_errors.extend([float(abs(h-true_h)),float(abs(h_alt-true_h))])
    q=st/ct
    hit=[ct*(x+q*y) for x,y in zip(p,d)]
    direction=[ct*(y+q*x) for x,y in zip(p,d)]
    projection=lin(ld(hit,n1),n1,ld(hit,n2),n2)
    normal=lin(1,projection,s2,hit)
    norm=ld(normal,normal).sqrt()
    face=abs(ld(direction,normal))/norm
    geometric_facing_errors.append(float(abs(face-abs(eta))))
    invariants.extend([float(abs(ld(p,p)+1)),float(abs(ld(d,d)-1)),float(abs(ld(p,d)))])
    bucket='t<4' if t<4 else '4<=t<8' if t<8 else '8<=t<=12'
    for mode in ('arithmetic_only','complete_projection'):
        if mode=='arithmetic_only':
            Pf,Df=list(map(float,P)),list(map(float,D))
        else:
            pf,df,n1f,n2f=[list(map(float,v)) for v in (p,d,n1,n2)]
            fld=lambda v,n:sum(x*y for x,y in zip(v[1:],n[1:]))-v[0]*n[0]
            Pf,Df=[fld(pf,n1f),fld(pf,n2f)],[fld(df,n1f),fld(df,n2f)]
        for name,hf in h_values(Pf,Df,float(s2)).items():
            key=f'{mode}/{bucket}/{name}'
            errors.setdefault(key,[]).append(float(abs(Q(hf)-true_h)/(s2*(1+s2))))
            counts.setdefault(key,{'cases':0,'false_miss':0,'non_grazing_cases':0,'non_grazing_false_miss':0,'outside_facing_bound':0})
            counts[key]['cases']+=1
            counts[key]['false_miss']+=hf<0
            counts[key]['non_grazing_cases']+=abs(eta)>.01
            counts[key]['non_grazing_false_miss']+=(hf<0 and abs(eta)>.01)
            counts[key]['outside_facing_bound']+=hf>float(s2*(1+s2))
        if mode=='arithmetic_only' and i<3:
            samples.append({'t':float(t),'eta':float(eta),'P':Pf,'D':Df,'expected':float(true_h),'values':h_values(Pf,Df,float(s2))})

radial=[]
s=math.sinh(.025)
for L in (1,10,15,30,100,1000,10000):
    radial.append({'L':L,'expected':s*s*(1+s*s),'double':h_values([-float(L),0.],[math.sqrt(1+L*L),0.],s*s)})
assert max(identity_errors)<1e-60
assert max(geometric_facing_errors)<1e-60
assert max(invariants)<1e-60
report={
    'precision_decimal_digits':90,'sample_count':900,
    'identity_max_absolute_error':max(identity_errors),
    'full_geometry_facing_max_absolute_error':max(geometric_facing_errors),
    'orthonormality_max_absolute_error':max(invariants),
    'error_definition':'abs(computed_h-exact_h)/(s^2*(1+s^2)): absolute error in squared facing, before clamp',
    'float64_cases':{key:{**stats(values),**counts[key]} for key,values in sorted(errors.items())},
    'radial_cases':radial,'examples':samples,
}
assert stats(errors['arithmetic_only/4<=t<8/factored'])['max'] < 1e-6
assert stats(errors['arithmetic_only/4<=t<8/naive'])['max'] > 1
print('Verified discriminant and facing identities on 900 boosted tube hits at 90-digit precision.')
print('The factored discriminant also passes the near-cusp float64 cancellation regression.')

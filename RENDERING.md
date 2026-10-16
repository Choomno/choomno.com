# Rendering the complete Borromean complement

The homepage renders only the complete hyperbolic limit of the Borromean rings
complement. The selected reference is [Not Knot, 13:29](https://www.youtube.com/watch?v=IrlaVaATiOY&t=809).
The visible silver scaffold is the thickened edge skeleton of a rhombic
dodecahedral fundamental domain. The deleted ring components lie at infinity:
six ideal vertices identify in pairs to give the three cusps. There are no
finite ring axes, cone deformations, or opaque cusp cross sections in the display.

## Exact fundamental domain

`rhombic-data.json` is exported from SnapPy 3.3.2:

    snappy.ManifoldHP('L6a4').dirichlet_domain()

After a spatial orthogonal change of coordinates, the domain has:

- six ideal vertices (1, ±eᵢ);
- eight finite vertices (1, ±1/2, ±1/2, ±1/2) in homogeneous Klein coordinates;
- twelve faces with unit outward normals given by permutations of (1, ±1, ±1, 0);
- twenty-four edges, each joining a finite and an ideal vertex;
- twelve exact integer Lorentz face pairing matrices.

The exporter checks the numerical conjugation before recognizing integer and
half-integer entries. The tests then use exact rational arithmetic to verify
Lorentz preservation, inverse pairings, face and edge images, vertex classes,
and the three cusp identifications. This is the actual Borromean quotient,
not an arbitrary reflection orbifold. Its canonical decomposition also has
two regular ideal octahedra.

`borromean-data.json` retains the independent eight-tetrahedron description
of the same manifold, including an exact certificate over Q(i) for all eight
edge and six peripheral completeness equations. The shapes are 1+i or (1+i)/2.

## Intrinsic ray tracing

The small WebGL 2 renderer uses the Lorentz form
⟨x,y⟩ = −x₀y₀+x₁y₁+x₂y₂+x₃y₃. At a point p with unit tangent v,

    γ(s) = cosh(s) p + sinh(s) v.

For a face normal n, its intersection parameter is

    tanh(s) = −⟨p,n⟩ / ⟨v,n⟩.

Both point and tangent are transformed by the exact face pairing and tracing
continues in the paired cell. Camera motion uses these same identifications.

For each edge, normalize its finite endpoint a, scale its null endpoint u so
⟨a,u⟩=−1, and set t=u−a. A tube of hyperbolic radius r around that geodesic ray
satisfies

    ⟨x,a⟩² − ⟨x,t⟩² = cosh²(r),   ⟨x,t⟩ ≥ 0.

Substitution of γ gives a quadratic in tanh(s). Radius-r balls at the eight
finite vertices join the incident beams. The radius is 0.047 in curvature −1
units. Geodesics and intersections are analytic; no Euclidean perspective
substitute or numerical ODE integrator is used.

The optional Cusp colors control tints a beam toward the cusp of its ideal
endpoint. It labels the ideal ends of the scaffold; it does not draw an axis
or add a boundary at a finite distance. Silver is the default, matching the
complete-limit frame of the film. Shading and distance attenuation are
presentation choices rather than a global illumination calculation.

## Numerical rendering limits

The domain data and pairing identities are exact. JavaScript camera arithmetic
uses doubles, while the GPU uses float32. Pixel resolution, a face crossing
limit of 48 / 96 / 160, and a distance cutoff of 24 bound rendering work.
Grazing intersections and very distant structure remain subject to floating
point rounding. The image is not claimed to have certified pixel accuracy.

## Sources and open-source implementations

- [SnapPy](https://github.com/3-manifolds/SnapPy) supplies the manifold data.
  Its [inside view](https://snappy.computop.org/manifold.html#snappy.Manifold.inside_view)
  is a mature intrinsic hyperbolic ray tracer. SnapPy is GPL-2.0-or-later.
- [non-euclidean_VR](https://github.com/henryseg/non-euclidean_VR), by Coulon,
  Matsumoto, Segerman, Trettel and contributors, renders Thurston geometries
  and quotients in the browser. GPL-3.0-or-later. No code is bundled here.
- [hypVR](https://github.com/hawksley/hypVR) is an older hyperbolic browser
  navigation project. No code is bundled here.
- [Epstein–Gunn, Not Knot supplement](https://www.cs.ubc.ca/~tmm/gc/supplements/NotKnotSupplement.pdf)
  explains the rhombic dodecahedron, its beams, and its ideal ends.
- [Thurston, §3.4](https://library.slmath.org/books/gt3m/PDF/3.pdf)
  constructs the Borromean complement from two ideal octahedra.

The renderer is an independent implementation of the stated analytic geometry;
it does not bundle or port another project's GLSL shader.

## Reproduce

Serve the repository root over HTTP:

    python -m http.server 8000 --bind 127.0.0.1

No build step or browser library is needed for the renderer. WebGL 2 is required;
MathJax 3.2.2 loads from jsDelivr. Existing secondary pages keep their shared layout.

Regenerate the data with `snappy==3.3.2` installed:

    python tools/export-rhombic.py
    python tools/export-borromean.py

Run independent checks:

    python tests/rhombic_exact.py
    node --experimental-default-type=module tests/rhombic.mjs
    python tests/exact_gluing.py
    node --experimental-default-type=module tests/intrinsic.mjs

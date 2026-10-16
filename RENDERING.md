# Rendering a dodecahedral knot complement

The homepage renders the complete hyperbolic complement of the
Aitchison–Rubinstein dodecahedral knot listed in SnapPy as `odode02_00913`.
Its decomposition has two regular ideal dodecahedra. The visible neutral
scaffold is the thickened edge skeleton of the lifted decomposition.

Each cell has twelve pentagonal faces, thirty edges, and twenty ideal
vertices. All forty cell vertices identify to one cusp in the quotient.
That cusp has infinitely many distinct lifts on the ideal boundary of
hyperbolic space, so multiple ideal ends can appear in one view. The
camera path is composed around those ends and the pentagonal chambers.

## Cell data and identification

`dodecahedral-data.json` contains two cells and their oriented face pairings.
`tools/export-dodecahedral.py` starts with SnapPy's high-precision manifold
`odode02_00913`, computes its canonical cell structure, develops tetrahedra
across transparent internal faces, and merges coplanar boundary triangles
into pentagons. The 51 tetrahedra develop into cells containing 25 and 26
tetrahedra, respectively. Each resulting cell is centered and aligned with
the same standard regular ideal dodecahedron. Crossing a face applies its
Lorentz matrix and updates the cell index.

In homogeneous Klein coordinates, with φ = (1 + √5)/2, the ideal vertices
are (1, v/√3), where v ranges over

    (±1, ±1, ±1)
    (0, ±1/φ, ±φ) and its cyclic coordinate permutations.

The regular ideal dodecahedron has dihedral angle π/3, so six cell wedges
meet around each quotient edge. Its horospherical vertex sections are
Euclidean equilateral triangles.

SnapPy supplies the combinatorial face identifications. Given each face's
vertex permutation, `tools/dodecahedral_algebra.py` reconstructs the pairing
as a symmetry of the canonical dodecahedron followed by reflection in the
target face. Vertices, normals, and matrices are constructed over
Q(√3, √5). The JSON `exactCertificate` stores rational coefficients in the
basis (1, √3, √5, √15), alongside the double-precision values used by the
browser. The comparison with SnapPy's developed geometry has maximum error
less than 2.4 × 10⁻¹⁴. The complete manifold has one cusp and volume
approximately 41.1603987078.

`tools/dodecahedral_reconstruction.py` reconstructs a 60-tetrahedron
retriangulation directly from the exported polygon face maps, without the
source tetrahedra or their coordinates. Its canonical isometry signature
matches the SnapPy census manifold. This identifies the exported quotient;
the separate algebraic tests verify its geometric gluing data. Re-exporting
the dataset reproduces the same JSON byte for byte.

`tests/dodecahedral_exact.py` uses rational coefficient arithmetic in
Q(√3, √5), with rational interval bounds for algebraic signs. It verifies:

- Exact ideal vertices, supporting face planes, and π/3 dihedral angles.
- All 24 face pairings, including Lorentz metric preservation, determinant
  +1, preservation of the future cone, inverse pairings, and vertex images.
- Ten quotient edge classes, each with six wedges and identity holonomy.
- One connected, orientable cusp link with 40 triangles, 60 edges, and
  20 vertices: a flat torus. The face pairings match normalized null
  vertices exactly, so they preserve compatible horospheres without
  scaling. The resulting cusp is complete.
- Agreement of the browser's numerical payload with the exact certificate
  to an absolute tolerance of 3 × 10⁻¹³.

SnapPy's [Platonic census documentation](https://snappy.computop.org/platonic_census.html)
identifies `odode02_00913` as one of the Aitchison–Rubinstein knot complements.
Hoffman's [classification theorem](https://arxiv.org/abs/1209.1004) establishes
that their two examples are the only knot complements that decompose into
regular ideal dodecahedra.

## Intrinsic ray tracing

`polyhedral.js` traces rays using the Lorentz form
⟨x,y⟩ = −x₀y₀ + x₁y₁ + x₂y₂ + x₃y₃. At a point p with unit tangent v,

    γ(s) = cosh(s) p + sinh(s) v.

For a face normal n, the intersection parameter is

    tanh(s) = −⟨p,n⟩ / ⟨v,n⟩.

The ray continues across the paired face after both its point and tangent
are transformed by the same Lorentz matrix. Camera frames are reduced into
the two-cell domain using these same identifications. Camera and text share
one path definition in `camera-path.js`.

For an edge with future-pointing null endpoints u and v, set

    a = (u + v) / √(−2⟨u,v⟩),
    t = (v − u) / √(−2⟨u,v⟩).

Then ⟨a,a⟩ = −1, ⟨t,t⟩ = 1, and ⟨a,t⟩ = 0. The edge is the complete
geodesic γ(s) = cosh(s)a + sinh(s)t, for all real s. Its radius-r tube has
equation

    ⟨x,a⟩² − ⟨x,t⟩² = cosh²(r).

For numerical evaluation, the renderer constructs an orthonormal basis
n₁, n₂ of the spacelike plane orthogonal to a and t. On the hyperboloid,
the same tube equation is

    ⟨x,n₁⟩² + ⟨x,n₂⟩² = sinh²(r).

This sum of squares avoids subtracting large, nearly equal longitudinal
terms near a cusp. The basis is computed in double precision and stored in
the GPU texture. For a camera ray with initial point p and tangent d, let
P = (⟨p,n₁⟩, ⟨p,n₂⟩), D = (⟨d,n₁⟩, ⟨d,n₂⟩), and ρ = sinh(r).
Substitution gives the quadratic in q = tanh(s):

    (|D|² + ρ²)q² + 2(P·D)q + |P|² − ρ² = 0.

Both roots are checked against the next face crossing, and the nearest
positive hit is used. Every edge joins two ideal endpoints, so there are
no finite caps. The intersection calculation is analytic.
`tests/tube-stability.mjs` compares the equations against independent
intersections and known transverse rays, including float32 arithmetic
near cusps and near tangency.

The tube radius is 0.025 in curvature −1 units. The page uses muted neutral
beams, narrow warm reflections, and a charcoal background. The material's
base RGB values are (0.32, 0.3136, 0.297). At distance d, visibility is
weighted by exp(−0.18d)/(1 + 0.18d²), retaining more of the distant scaffold
while keeping it subordinate to nearby beams. Material shading, attenuation,
and beam thickness are presentation choices.

## Camera and section transitions

The camera follows a planar route around the center of one fixed, unfolded
cell. It always looks inward toward that original center, including while
its representative crosses into neighboring cells. The four reading stops
have logical phases 0, π/4, π/2, and 3π/4. Their positions are chosen from
the cell geometry:

- The opening stop is at hyperbolic radius 2.54 in direction
  (1, 0, φ)/√(φ + 2), perpendicular to a pentagonal face.
- Background is at radius 3.4 in the direction of ideal vertex 7,
  (1, 1, 1)/√3.
- Currently is at radius 3.2 in the direction of ideal vertex 19,
  (1/φ, φ, 0)/√3.
- Elsewhere is antipodal to the opening stop, at radius 2.54.

At both middle stops, the selected ideal vertex lies exactly behind the
camera. Its Busemann height relative to the horosphere through the original
cell center equals the corresponding reading radius. The opening and final
frames orient their pentagons upright; the middle frames make their
triangular configurations readable.

`camera-path.js` joins the anchors with three quadratic Bézier arcs in
Klein coordinates. Each control point has Euclidean norm 0.88 and lies in
the direction of the sum of its adjacent anchors. The route therefore
retreats toward the center between the deeper cusp views, passing inside
the connecting edge. Its planarity and sampled clearance from the edge
tubes are checked numerically. Across 18,001 sampled poses, the minimum
edge-axis distance is approximately 0.08128, versus the tube radius 0.025.

Each leg is reparameterized using a hyperbolic arclength table sampled at
8192 intervals. Equal phase increments then move the eye approximately
equal hyperbolic distances along that leg. Roll angles of 18°, 30°, −30°,
and 18° at the four stops are interpolated along the legs. Reverse
navigation retraces the same route. Text enters from the right and exits
to the left.

Each wheel gesture, swipe, tap, or navigation control selects one section.
A transition between adjacent section centers takes 1.45 seconds and uses
quintic smootherstep. Jumps across several sections ease through each leg
separately, taking 1.45 seconds per leg and reaching zero velocity and
acceleration at each intervening reading stop. A monotone cubic
interpolation maps the scroll coordinate to camera phase; background and
text use the same phase without additional lag. The camera rests between
gestures.

Pause background freezes its pose while text navigation selects centered
stills. Reduced-motion preferences similarly use immediate section changes
and a static background. Resume background synchronizes with the selected
section.

## Projected text

Each reading block is anchored to a plane at its corresponding camera stop.
`projection.js` constructs the plane in homogeneous Klein coordinates and
projects it using the inverse Lorentz camera frame and the renderer's field
of view. Its projective interpolation lies in a totally geodesic plane.
At the matching reading pose the projection recovers the centered HTML text
rectangle; viewport and font changes recalibrate that rectangle.

The plane is transparent except for its HTML text. It is drawn as a CSS
projective overlay, with opacity reduced as its reading pose leaves view.
A separate quintic fade hides the whole plane smoothly before its nearest
corner reaches the camera's near clip, avoiding abrupt disappearance when
the camera crosses a stationary text plane. These are selected lifts in the
universal cover: the page does not generate deck-translated copies of the
text or depth-test it against scaffold beams.
The text is therefore a presentation layer, not additional quotient-invariant
geometric scenery. Ordinary HTML flow remains available when the text will
not fit the viewport, and a graphics failure does not remove the content.

## Numerical rendering limits

The algebraic certificate specifies exact geometry and face pairings.
JavaScript camera arithmetic uses doubles, while the GPU uses float32.
Pixel resolution, a face crossing limit of 96 / 160 / 240, and a traveled
distance cutoff of 32 bound rendering work. A local face-intersection
parameter tanh(s) ≥ 0.999999 also terminates tracing to avoid unstable
near-ideal arithmetic. Grazing intersections and very distant structure
remain subject to floating point rounding. The image is not
claimed to have certified pixel accuracy.

## Historical Borromean data

`rhombic-data.json` and `borromean-data.json` retain the previous Borromean
rings complement (`L6a4`) for independent regression checks. Their rhombic
dodecahedral and eight-tetrahedron descriptions have the same isometry
signature and volume 7.327724753417752. The rhombic data has exact integer
Lorentz face pairings; the tetrahedral data includes an exact certificate
over Q(i) for its edge and peripheral completeness equations. These files
are not loaded by the homepage.

The old rhombic domain has both finite and ideal vertices, unlike the
regular ideal dodecahedra now displayed. Its tests and `rhombic.js` preserve
the finite-to-ideal tube and cap calculations as regression coverage.

## Sources and implementation

- [SnapPy](https://github.com/3-manifolds/SnapPy) supplies the manifold and
  canonical decomposition. Its [inside view](https://snappy.computop.org/manifold.html#snappy.Manifold.inside_view)
  is an intrinsic hyperbolic ray tracer. SnapPy is GPL-2.0-or-later.
- [SnapPy's Platonic census](https://snappy.computop.org/platonic_census.html)
  identifies the selected knot complement.
- [Hoffman, *On knot complements that decompose into regular ideal dodecahedra*](https://arxiv.org/abs/1209.1004)
  describes the Aitchison–Rubinstein examples and classifies dodecahedral
  knot complements.
- [non-euclidean_VR](https://github.com/henryseg/non-euclidean_VR), by Coulon,
  Matsumoto, Segerman, Trettel and contributors, renders Thurston geometries
  and quotients in the browser. GPL-3.0-or-later. No code is bundled here.

The browser renderer is an independent implementation of the stated
analytic geometry; it does not bundle another project's GLSL shader.

## Reproduce

Serve the repository root over HTTP:

    python -m http.server 8000 --bind 127.0.0.1

No build step or browser library is needed for the renderer. WebGL 2 is
required for the background; MathJax 3.2.2 loads from jsDelivr.

Regenerate the current data with `snappy==3.3.2` installed:

    python tools/export-dodecahedral.py

Check the current geometry and browser-independent navigation/projection:

    python tools/dodecahedral_algebra.py
    python tests/dodecahedral_exact.py
    node --experimental-default-type=module tests/dodecahedral.mjs
    node --experimental-default-type=module tests/tube-stability.mjs
    node --experimental-default-type=module tests/scroll-choreography.mjs
    node --experimental-default-type=module tests/projection.mjs
    node --experimental-default-type=module tests/section-navigation.mjs
    node --experimental-default-type=module tests/scene-fallback.mjs

The dodecahedral ray tests exercise paired-cell crossings and independent
tube intersections in both directions along an edge. They also check
clearance from the scaffold along the camera route, approximately uniform
hyperbolic speed within each leg, and the geometric visibility of several
ideal endpoints at each reading stop. Geometric
visibility is a field-of-view check; it does not promise a particular
contrast or exclude occlusion by another beam.

The original data can be regenerated with:

    python tools/export-rhombic.py
    python tools/export-borromean.py

Its regression checks remain available:

    python tests/rhombic_exact.py
    node --experimental-default-type=module tests/rhombic.mjs
    python tests/exact_gluing.py
    node --experimental-default-type=module tests/intrinsic.mjs

The animation is a fixed full-page background with muted neutral beams.
Background controls are collapsible, reduced-motion preferences are
respected, and render resolution is capped at 1600 by 1000 to bound
full-screen GPU work.

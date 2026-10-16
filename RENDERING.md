# Rendering the complete Borromean complement

The homepage renders only the complete hyperbolic limit of the Borromean rings
complement. The selected reference is [Not Knot, 13:29](https://www.youtube.com/watch?v=IrlaVaATiOY&t=809).
The visible neutral scaffold is the thickened edge skeleton of a rhombic
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
Lorentz and orientation preservation, inverse pairings, face and edge images,
and identity holonomy around each of the six quotient edges. Four right
wedges meet at every edge. Computing the vertex links from the pairings gives
one spherical finite vertex link (6 vertices, 12 edges, 8 triangles) and
three torus cusp links (2 vertices, 4 edges, 2 squares each). The pairings
preserve compatible horospheres at ideal vertices.

The identification with the Borromean complement comes from SnapPy's L6a4
triangulation. The exporter reconstructs the quotient from the Dirichlet
domain and compares its isometry signature with L6a4. The rhombic and
tetrahedral exports also have matching signatures and volume
7.327724753417752. These provenance checks use SnapPy; the rational checks
independently verify the supplied geometric gluing data. Its canonical
decomposition also has two regular ideal octahedra.

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
The camera follows a circular orbit about the finite center
of a fundamental cell, at hyperbolic distance 2.4 from that center. The camera
looks inward toward the center throughout the orbit and its vertical axis
stays fixed. At this radius the orbit approaches the ideal vertices and crosses
fundamental faces; each pose is reduced through the actual face pairings before
ray tracing. Each pose is a spatial rotation of a radial Lorentz boost followed
by a half-turn of the camera. Section reading positions drive the orbit through
three eighths of a revolution, with reverse navigation retracing the path.
The phase convention is `readingPose(phase) = cellTurn(-phase)`, so text enters
from the right. At Background (phase pi/4), the +z ideal endpoint is precisely
behind the camera.

Each wheel gesture, swipe, tap, or navigation control selects one section.
The scroll coordinate moves between section centers over 1.1 seconds using
quintic smootherstep. A monotone cubic interpolation maps that coordinate
to camera phase; both the background and text use this same phase with no
additional lag. The camera rests at a reading pose between gestures.
Pause background freezes its pose while text navigation selects centered
stills. Reduced-motion preferences similarly use immediate section changes
and a static background. Resume background synchronizes with the selected
section.

For each edge, normalize its finite endpoint a, scale its null endpoint u so
⟨a,u⟩=−1, and set t=u−a. A tube of hyperbolic radius r around that geodesic ray
satisfies

    ⟨x,a⟩² − ⟨x,t⟩² = cosh²(r),   ⟨x,t⟩ ≥ 0.

Substitution of γ gives a quadratic in tanh(s). Radius-r balls at the eight
finite vertices join the incident beams. The radius is 0.035 in curvature −1
units. Geodesics and intersections are analytic; no Euclidean perspective
substitute or numerical ODE integrator is used.

The page uses a neutral ceramic material, narrow warm reflections, and a
charcoal background. The shader retains an optional cusp tint, but the page
keeps it disabled. Depth attenuation keeps distant structure subordinate.
Shading and distance attenuation are presentation choices rather than a
global illumination calculation.

## Projected text

Each reading block is anchored to a plane at its corresponding camera stop.
`projection.js` constructs the plane in homogeneous Klein coordinates and
projects it using the inverse Lorentz camera frame and the renderer's field
of view. Its projective interpolation lies in a totally geodesic plane.
At the matching reading pose the projection recovers the centered HTML text
rectangle; viewport and font changes recalibrate that rectangle.

The plane is transparent except for its HTML text. It is drawn as a CSS
projective overlay, with opacity reduced as its reading pose leaves view.
These are selected lifts in the universal cover: the page does not generate
deck-translated copies of the text or depth-test it against scaffold beams.
The text is therefore a presentation layer, not additional quotient-invariant
geometric scenery. Ordinary HTML flow remains available when the text will
not fit the viewport, and a graphics failure does not remove the content.

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

No build step or browser library is needed for the renderer. WebGL 2 is required
for the background; MathJax 3.2.2 loads from jsDelivr.

Regenerate the data with `snappy==3.3.2` installed:

    python tools/export-rhombic.py
    python tools/export-borromean.py

Run independent checks:

    python tests/rhombic_exact.py
    node --experimental-default-type=module tests/rhombic.mjs
    python tests/exact_gluing.py
    node --experimental-default-type=module tests/intrinsic.mjs
    node --experimental-default-type=module tests/scroll-choreography.mjs
    node --experimental-default-type=module tests/projection.mjs
    node --experimental-default-type=module tests/section-navigation.mjs
    node --experimental-default-type=module tests/scene-fallback.mjs

The animation is a fixed full-page background with muted neutral beams.
Background controls are
collapsible, reduced-motion preferences are respected, and render resolution
is capped at 1600 by 1000 to bound full-screen GPU work.

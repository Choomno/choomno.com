# Rendering a dodecahedral knot complement

The homepage renders the complete hyperbolic complement of the
Aitchison–Rubinstein dodecahedral knot listed in SnapPy as `odode02_00913`.
Its decomposition has two regular ideal dodecahedra. The visible neutral
scaffold is the thickened edge skeleton of the lifted decomposition.
The intrinsic ray tracing runs offline; visitors play the resulting video
and do not compile or execute the hyperbolic fragment shader.

Each cell has twelve pentagonal faces, thirty edges, and twenty ideal
vertices. All forty cell vertices identify to one cusp in the quotient.
That cusp has infinitely many distinct lifts on the ideal boundary of
hyperbolic space, so multiple ideal ends can appear in one view. The
camera path is composed around those ends and the pentagonal chambers.

## Prerendered playback

The three adjacent camera routes have forward and reverse clips. Each is
sampled at 60 fps, with 481 frames including both exact endpoints. The
geometric timeline is 8 seconds; the last frame is presented at PTS 8.0,
and the encoded container lasts 481/60 seconds. Reverse clips reuse exactly
the same source frames in reverse order. Every source frame is evaluated by
analytic ray tracing through the recorded face pairings; no optical-flow
interpolation is used.

Motion is rendered at 2880 × 1440 and Lanczos-downsampled to 1920 × 960.
Station posters are rendered at 5760 × 2880 and reduced to 3840 × 1920.
All renders use 160 face crossings and the same distance cutoff and material.
Portrait assets are center crops of these masters: 720 × 960 video and
1440 × 1920 posters. They preserve the vertical field of view while reducing
mobile decoding and download costs.

`tools/prerender-scene.mjs` exports the exact packed scene and the camera
frames computed by `camera-path.js` and `transition-timing.js`.
The native EGL renderer uses desktop OpenGL double precision for the offline
geometry calculation. Its uniform buffer preserves the double-precision
scene constants. The retained browser shader explicitly qualifies its geometry
sampler as `highp`; single-precision ray tracing is not used for the media.
Double precision removes the conspicuous fuzzy clouds produced by accumulated
rounding in the earlier float32 face traversal.

`prerendered.js` anchors HTML text and navigation to each presented video
frame’s `mediaTime` and `expectedDisplayTime`, using
[`requestVideoFrameCallback`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback). During transitions, display-refresh
callbacks interpolate the text clock up to one video frame beyond the latest
presentation timestamp. This smooths subframe motion while bounding any
lead over a stalled decoder; waiting, pause, and hidden-tab states freeze it.
Older browsers use the media element's playback time. `text-suspension.js`
attaches the projected text to this route coordinate with an exactly integrated
critically damped spring (55 radians/second), absorbing callback jitter with
about 36 ms of lag for steady motion. Reading stops, rewind, resizing, and
reduced-motion changes settle on the exact geometry; the spring runs only
while its target is changing or it is settling. There is no continuous
application rendering loop while a reading station is at rest. WebM carries
10-bit AV1, preferred when the browser advertises Main-profile level 4.1
10-bit decoding (`av01.0.09M.10`). MP4 provides an H.264 fallback. Both use
two-pass encoding at 4 Mbps for landscape and 1.5 Mbps for portrait, with up
to eight seconds between keyframes. AV1 uses libaom CPU 4; H.264 uses x264's
veryslow preset and extra bit allocation at both ends of each transition.
Blocked playback, codec failures, or a long stall settle on the destination
poster with functional text and navigation. Versioned video URLs prevent
cached VP9 or older high-bitrate H.264 files from being reused.

After the opening poster is decoded, `video-cache.js` fetches the six clips
for the current aspect ratio and supported codec, one at a time. Navigation
prioritizes its clip and shares any download already in progress. Each file
is completely downloaded to a Blob before playback starts, so network
stalls cannot interrupt the transition. The cache retains at most one
six-clip family and revokes object URLs when that family changes or the
player is destroyed. Save-Data and reduced-motion preferences disable eager
loading; hidden tabs stop starting speculative downloads.

Portrait and landscape masters use `object-fit: cover`. On viewports wider
than the 2:1 master, `projection.js` uses the same cropped vertical field
of view for the text. Ordinary viewports retain the original camera field.
Pause, reduced motion, immediate rewind, hash changes, and resize cancel
playback safely and restore exact reading positions. The manifest records
source hashes, dimensions, sampling settings, and every asset's checksum.

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
scene exporter. The comparison with SnapPy's developed geometry has maximum error
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
the high-precision scene buffer. For a camera ray with initial point p and tangent d, let
P = (⟨p,n₁⟩, ⟨p,n₂⟩), D = (⟨d,n₁⟩, ⟨d,n₂⟩), and ρ = sinh(r).
Substitution gives the quadratic in q = tanh(s):

    (|D|² + ρ²)q² + 2(P·D)q + |P|² − ρ² = 0.

The offline shader evaluates one quarter of the discriminant as

    h = ρ² ((D − P)·(D + P) + ρ²) − det(P,D)²,

using fused multiply-adds for the determinant. This avoids cancellation
between the much larger quartic terms in the expanded discriminant.
At a hit, the absolute cosine used for shading is

    √h / (ρ √(1 + ρ²)).

This follows by differentiating the tube equation along the unit-speed ray;
it avoids constructing and normalizing a Lorentz normal with large,
nearly cancelling components. These are algebraic rewrites of the same
intersection and material calculation.

`tests/tube-double.py` independently checks the discriminant and facing
identities at 90 decimal digits on 900 boosted tube hits, including a
float64 case where the expanded discriminant incorrectly becomes negative.

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

The camera moves around the center of one fixed, unfolded cell and always
looks toward that center, including while its representative crosses into
neighboring cells. The four logical reading phases are 0, π/4, π/2, and
3π/4. Their positions and orientations come from the cell geometry:

- The opening stop is at hyperbolic radius 2.54 in direction
  (1, 0, φ)/√(φ + 2), perpendicular to a pentagonal face.
- Background is at radius 3.4 toward ideal vertex 7, (1, 1, 1)/√3.
  That ideal point lies exactly behind the camera, at Busemann height 3.4
  relative to the horosphere through the cell center.
- Currently is at radius 1.35 in the direction (1, φ, 1/φ)/2, toward the
  midpoint of edge (7, 19). Its horizontal twofold orientation provides
  a distinct, broadly hexagonal composition.
- Elsewhere is antipodal to the opening stop, at radius 2.54, with its
  pentagon pointing downward rather than upward.

Each leg starts with a geodesic sidestep of length 0.012 toward screen-right.
A quartic Bézier bridge in Klein coordinates then turns inward and reaches
the next station from its left. The final 0.012 is another geodesic sidestep.
The bridge control points share the sidesteps' tangent lines. These small
lateral movements clear the nearby stationary text before the larger
movement through the cell. They produce strong text parallax with little
movement of the surrounding edges. The middle control point has Klein radius
0.8: the shallower inward arc spreads the center-facing turn rather than
concentrating rotation near the cell center.

The bridge is sampled at 8192 intervals, clustered near its endpoints, and
reparameterized by hyperbolic arclength. Equal phase increments move the eye
approximately equal distances within a leg. The up vectors at both reading
stops are transported to the current radial direction and blended by a
quintic roll interpolation. Position and camera-frame derivatives join
continuously. Reverse navigation retraces the same route; text enters from
the right and exits to the left.

Independent numerical tests check Lorentz frames, tangent continuity,
arclength, and clearance. Across 24,001 camera samples, the nearest edge-axis
distance is approximately 0.0697, versus the tube radius 0.025. A separate
intersection test locates crossings of the infinite text planes and checks
that each is outside the finite reading rectangle, using five desktop and
mobile footprints. Neither opacity nor clipping is used to establish that
clearance.

Each wheel gesture, swipe, tap, or navigation control selects one section.
`transition-timing.js` reserves 1.6 seconds for the departure sidestep,
4.8 seconds for the bridge, and 1.6 seconds for the arrival sidestep. The
timeline has continuous velocity and acceleration, with positive velocity
at both sidestep/bridge handoffs. A quintic velocity ramp leads into and out
of a broad constant-speed middle. The eye comes to rest only at reading
stops. A complete adjacent transition takes 8 seconds. Jumps across
several sections traverse each leg separately; reverse navigation retraces
the same timed path.

The navigation controller reports a continuous logical section position
directly to the renderer and text projection. Native scroll positions are
rounded by the browser: a sidestep occupies only a few CSS scroll pixels,
so those positions cannot drive the near text smoothly. In projected mode,
scroll and visibility events consult the controller's unrounded progress.
Immediate navigation, hashes, resizing, and reduced motion also report exact
station positions. In ordinary document flow the background selects the
nearest station poster, keeping scrolling readable without video seeking.

`tests/text-transition.mjs` verifies the timeline joins, reversal, fully
opaque entry from the viewport edge, and a visible arrival of at least
0.75 seconds across the tested desktop/mobile layouts. The scene integration
test rounds native scroll positions and confirms that camera and text still
move continuously, including after delayed scroll and visibility events.

Pause background freezes its pose while text navigation selects centered
stills. Reduced-motion preferences similarly use immediate section changes
and a static background. Resume background synchronizes with the selected
section.

## Projected text

Each reading block is anchored to a plane at its corresponding camera stop.
`projection.js` constructs the plane in homogeneous Klein coordinates and
projects it using the inverse Lorentz camera frame and the renderer's field
of view. Its projective interpolation lies in a totally geodesic plane.
In its station frame the plane has spatial depth 0.005, with its width and
height scaled proportionally. At the matching reading pose it recovers the
same centered HTML rectangle. Its small intrinsic size and proximity make
the ambient geometry appear much larger by comparison during a sidestep.
Viewport and font changes recalibrate the rectangle. At an exact reading
stop, this projective transform reduces to a centered translation; the page
uses that equivalent 2D transform and releases compositor hints so text is
rasterized sharply at rest.

The plane is transparent except for its HTML text. It is drawn as a CSS
projective overlay, with opacity reduced as its reading pose leaves view.
A separate quintic fade hides the whole plane smoothly before its nearest
corner reaches the camera's near clip, avoiding abrupt disappearance as
the camera passes beside a stationary text rectangle. The fade and clip
thresholds scale with the plane depth. These are selected lifts in the
universal cover: the page does not generate deck-translated copies of the
text or depth-test it against scaffold beams.
The text is therefore a presentation layer, not additional quotient-invariant
geometric scenery. Ordinary HTML flow remains available when the text will
not fit the viewport, and a media failure does not remove the content.

## Numerical rendering limits

The algebraic certificate specifies exact geometry and face pairings.
JavaScript camera arithmetic and offline geometric ray tracing use doubles.
The offline renderer preserves double precision in the scene constants,
camera uniforms, face crossings, and tube intersections; material colors
and the final encoded image have finite precision. Pixel resolution, a face crossing limit of 160, and a traveled
distance cutoff of 20 bound rendering work. A local face-intersection
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

The offline renderer is an independent implementation of the stated
analytic geometry; it does not bundle another project's GLSL shader.

## Reproduce

Serve the repository root over HTTP:

    python -m http.server 8000 --bind 127.0.0.1

No client build step, browser library, or WebGL context is needed for playback.
MathJax 3.2.2 loads from jsDelivr. To regenerate media, install Python with
Pillow, native EGL with desktop OpenGL double-precision support (such as Mesa),
and FFmpeg with the required codecs:

    node --experimental-default-type=module tools/prerender-scene.mjs /tmp/site-render
    python tools/prerender-media.py --work /tmp/site-render --output media

The raw frames stay outside the served repository. Rendering is resumable;
source geometry and quality hashes must match before existing frames are reused.
A custom encoder can be selected with `--ffmpeg /path/to/ffmpeg` or
`FFMPEG_BINARY`. The build requires `libx264` and `libvpx-vp9`; a workspace-local
`imageio-ffmpeg` installation can supply them without adding a site dependency.
`--encode-only` changes compression without recalculating geometry.

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
    node --experimental-default-type=module tests/text-transition.mjs
    node --experimental-default-type=module tests/scene-fallback.mjs
    node --experimental-default-type=module tests/prerendered.mjs
    node --experimental-default-type=module tests/media-assets.mjs

With the native render dependencies installed, also verify the float32
reference backend and the double-precision data, camera uniforms, and
cancellation-resistant radial intersection against a fresh export:

    python tests/prerender-native.py
    python tests/tube-double.py

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
Background controls are collapsible and reduced-motion preferences are respected.
Visitors decode prerecorded clips during transitions and display a still image
at each reading station.

Slide selection is local interface state. Navigation does not write URL
fragments or add history entries, and a fresh load clears old fragments and
starts at the first reading station.

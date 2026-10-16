"""Exact regular ideal dodecahedra over Q(sqrt(3), sqrt(5)).

The geometry here is independent of SnapPy's floating-point development.
SnapPy supplies only a combinatorial face identification; that identification
selects an exact symmetry of the canonical dodecahedron followed by reflection
in the target face.  Coordinates use the Lorentz form diag(-1, 1, 1, 1).
"""

from dataclasses import dataclass
from fractions import Fraction
from itertools import combinations, product
from math import isqrt, sqrt


@dataclass(frozen=True)
class Algebraic:
    """Coefficients of 1, sqrt(3), sqrt(5), sqrt(15), respectively."""

    coefficients: tuple

    def __init__(self, value=0):
        if isinstance(value, Algebraic):
            values = value.coefficients
        elif isinstance(value, (tuple, list)):
            if len(value) != 4:
                raise ValueError("Expected four rational coefficients")
            values = tuple(Fraction(x) for x in value)
        else:
            values = (Fraction(value), Fraction(0), Fraction(0), Fraction(0))
        object.__setattr__(self, "coefficients", values)

    def __add__(self, other):
        other = Algebraic(other)
        return Algebraic(tuple(a + b for a, b in zip(self.coefficients, other.coefficients)))

    __radd__ = __add__

    def __neg__(self):
        return Algebraic(tuple(-a for a in self.coefficients))

    def __sub__(self, other):
        return self + -Algebraic(other)

    def __rsub__(self, other):
        return Algebraic(other) + -self

    def __mul__(self, other):
        other = Algebraic(other)
        result = [Fraction(0)] * 4
        for i, a in enumerate(self.coefficients):
            for j, b in enumerate(other.coefficients):
                common = i & j
                result[i ^ j] += a * b * (3 if common & 1 else 1) * (5 if common & 2 else 1)
        return Algebraic(result)

    __rmul__ = __mul__

    def conjugate(self, mask):
        return Algebraic(tuple((-a if (i & mask).bit_count() % 2 else a)
                               for i, a in enumerate(self.coefficients)))

    def inverse(self):
        numerator = self.conjugate(1) * self.conjugate(2) * self.conjugate(3)
        norm = self * numerator
        assert all(x == 0 for x in norm.coefficients[1:])
        if norm.coefficients[0] == 0:
            raise ZeroDivisionError("Zero algebraic element")
        return Algebraic(tuple(x / norm.coefficients[0] for x in numerator.coefficients))

    def __truediv__(self, other):
        return self * Algebraic(other).inverse()

    def __rtruediv__(self, other):
        return Algebraic(other) * self.inverse()

    def __pow__(self, n):
        if n < 0:
            return self.inverse() ** -n
        result, base = Algebraic(1), self
        while n:
            if n & 1:
                result *= base
            base *= base
            n //= 2
        return result

    def __bool__(self):
        return any(self.coefficients)

    def __eq__(self, other):
        try:
            return self.coefficients == Algebraic(other).coefficients
        except (ValueError, TypeError):
            return False

    def __hash__(self):
        return hash(self.coefficients)

    def __float__(self):
        return sum(float(a) * b for a, b in zip(self.coefficients, (1, sqrt(3), sqrt(5), sqrt(15))))

    def sign(self):
        """Determine the real sign with rational bounds on the three radicals."""
        if not self:
            return 0
        bits = 16
        while True:
            scale = 1 << bits
            lower = upper = self.coefficients[0]
            for coefficient, radicand in zip(self.coefficients[1:], (3, 5, 15)):
                floor = isqrt(radicand << (2 * bits))
                lo, hi = Fraction(floor, scale), Fraction(floor + 1, scale)
                lower += coefficient * (lo if coefficient >= 0 else hi)
                upper += coefficient * (hi if coefficient >= 0 else lo)
            if lower > 0:
                return 1
            if upper < 0:
                return -1
            bits *= 2


ZERO, ONE = Algebraic(0), Algebraic(1)
SQRT3, SQRT5 = Algebraic((0, 1, 0, 0)), Algebraic((0, 0, 1, 0))
PHI = (ONE + SQRT5) / 2
J = (-1, 1, 1, 1)


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), ZERO)


def lorentz_dot(a, b):
    return sum((sign * x * y for sign, x, y in zip(J, a, b)), ZERO)


def transpose(a):
    return [list(row) for row in zip(*a)]


def matmul(a, b):
    return [[dot(row, col) for col in zip(*b)] for row in a]


def matvec(a, v):
    return [dot(row, v) for row in a]


def identity(size=4):
    return [[ONE if i == j else ZERO for j in range(size)] for i in range(size)]


def inverse(a):
    size = len(a)
    rows = [list(map(Algebraic, row)) + unit for row, unit in zip(a, identity(size))]
    for column in range(size):
        pivot = next((i for i in range(column, size) if rows[i][column]), None)
        if pivot is None:
            raise ValueError("Singular matrix")
        rows[column], rows[pivot] = rows[pivot], rows[column]
        scale = rows[column][column].inverse()
        rows[column] = [x * scale for x in rows[column]]
        for i in range(size):
            if i != column:
                scale = rows[i][column]
                rows[i] = [x - scale * y for x, y in zip(rows[i], rows[column])]
    return [row[size:] for row in rows]


def reflection(normal):
    norm = lorentz_dot(normal, normal)
    return [[(ONE if i == j else ZERO) - 2 * normal[i] * normal[j] * J[j] / norm
             for j in range(4)] for i in range(4)]


def canonical_geometry():
    spatial = [tuple(map(Algebraic, p)) for p in product((-1, 1), repeat=3)]
    for shift in range(3):
        for a, b in product((-1, 1), repeat=2):
            v = (ZERO, a / PHI, b * PHI)
            spatial.append(v[-shift:] + v[:-shift] if shift else v)
    vertices = [[ONE, *(x / SQRT3 for x in v)] for v in spatial]
    normals = []
    for a, b in product((-1, 1), repeat=2):
        x, y = a * PHI * SQRT3 / 2, b * SQRT3 / 2
        normals.extend(([PHI ** 2 / 2, ZERO, x, y],
                        [PHI ** 2 / 2, x, y, ZERO],
                        [PHI ** 2 / 2, y, ZERO, x]))
    faces = [[i for i, v in enumerate(vertices) if not lorentz_dot(n, v)] for n in normals]
    edges = [(i, j) for i, j in combinations(range(20), 2)
             if sum(i in f and j in f for f in faces) == 2]
    assert len(vertices) == 20 and len(normals) == 12 and len(edges) == 30
    assert all(len(f) == 5 for f in faces)
    assert all(lorentz_dot(v, v) == 0 for v in vertices)
    assert all(lorentz_dot(n, n) == 1 for n in normals)
    assert all(lorentz_dot(n, v).sign() <= 0 for n in normals for v in vertices)
    # Regular ideal dodecahedral dihedral angle is pi/3: adjacent outward
    # unit normals have Lorentz inner product -cos(pi/3) = -1/2.
    assert all(lorentz_dot(normals[i], normals[j]) == Fraction(-1, 2)
               for i, j in combinations(range(12), 2)
               if len(set(faces[i]) & set(faces[j])) == 2)
    return {"vertices": vertices, "normals": normals, "faces": faces, "edges": edges}


def face_pairing(source_face, target_face, vertex_map, geometry=None):
    """Reconstruct a pairing from >=3 independent face vertex matches.

    ``matrix`` sends the source cell across the target face; its restriction
    to the paired face realizes ``vertex_map`` exactly.  ``symmetry`` maps
    the whole canonical dodecahedron to itself before that reflection.
    """
    g = geometry or canonical_geometry()
    vertices, faces = g["vertices"], g["faces"]
    if not isinstance(source_face, int):
        source_face = next(i for i, face in enumerate(faces) if set(face) == set(source_face))
    if not isinstance(target_face, int):
        target_face = next(i for i, face in enumerate(faces) if set(face) == set(target_face))
    vertex_map = dict(vertex_map)
    if not set(vertex_map) <= set(faces[source_face]):
        raise ValueError("Source vertex is not in source face")
    if not set(vertex_map.values()) <= set(faces[target_face]):
        raise ValueError("Target vertex is not in target face")
    for basis in combinations(vertex_map, 3):
        try:
            source_inverse = inverse(transpose([vertices[i][1:] for i in basis]))
            break
        except ValueError:
            continue
    else:
        raise ValueError("Three independent source vertex vectors required")
    spatial = matmul(transpose([vertices[vertex_map[i]][1:] for i in basis]), source_inverse)
    if matmul(transpose(spatial), spatial) != identity(3):
        raise ValueError("Face matching does not extend to an orthogonal symmetry")
    symmetry = [[ONE, ZERO, ZERO, ZERO]] + [[ZERO, *row] for row in spatial]
    vertex_permutation = []
    for v in vertices:
        image = matvec(symmetry, v)
        try:
            vertex_permutation.append(vertices.index(image))
        except ValueError as exc:
            raise ValueError("Face matching does not preserve the dodecahedron") from exc
    if any(vertex_permutation[i] != j for i, j in vertex_map.items()):
        raise ValueError("Inconsistent face matching")
    matrix = matmul(reflection(g["normals"][target_face]), symmetry)
    assert all(matvec(matrix, vertices[i]) == vertices[j] for i, j in vertex_map.items())
    metric = [[Algebraic(J[i]) if i == j else ZERO for j in range(4)] for i in range(4)]
    assert matmul(matmul(transpose(matrix), metric), matrix) == metric
    return {"matrix": matrix, "symmetry": symmetry, "vertex_permutation": vertex_permutation}


def to_float(value):
    if isinstance(value, Algebraic):
        return float(value)
    if isinstance(value, dict):
        return {key: to_float(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_float(item) for item in value]
    return value


def serialize(value):
    """JSON-compatible exact coefficients, as reduced rational strings."""
    if isinstance(value, Algebraic):
        return [str(x) for x in value.coefficients]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize(item) for item in value]
    return value


if __name__ == "__main__":
    geometry = canonical_geometry()
    for f, vertices in enumerate(geometry["faces"]):
        result = face_pairing(f, f, {v: v for v in vertices}, geometry)
        assert result["symmetry"] == identity()
        assert matmul(result["matrix"], result["matrix"]) == identity()
    print("Exact dodecahedron: 20 ideal vertices, 30 edges, 12 regular faces; pi/3 dihedrals and reflections verified.")

"""Reconstruct SnapPy's canonical retriangulation from polygon face pairings.

This is a purely combinatorial check of the exported quotient.  The two
centers above each paired pentagon and each of its five edges determine
five tetrahedra. No coordinates, approximate matching, or original
tetrahedral subdivision enter the reconstruction.
"""

from collections import defaultdict


def _face_cycle(cell, face):
    vertices = set(face)
    adjacency = {v: [] for v in face}
    for a, b in cell["edges"]:
        if a in vertices and b in vertices:
            adjacency[a].append(b)
            adjacency[b].append(a)
    if not all(len(neighbors) == 2 for neighbors in adjacency.values()):
        raise ValueError("Face boundary is not a cycle")
    cycle = [min(vertices)]
    previous = None
    while True:
        neighbors = adjacency[cycle[-1]]
        nxt = next(v for v in neighbors if v != previous)
        if nxt == cycle[0]:
            break
        previous = cycle[-1]
        cycle.append(nxt)
        if len(cycle) > len(face):
            raise ValueError("Face boundary failed to close")
    if len(cycle) != len(face):
        raise ValueError("Face boundary is disconnected")
    return cycle


def tetrahedral_gluing_data(cells):
    """Return 4-face tetrahedral gluings for the double-suspension subdivision."""
    tetrahedra = []
    radial = defaultdict(list)
    halves = defaultdict(list)
    seen = set()
    for ci, cell in enumerate(cells):
        for fi, face in enumerate(cell["faces"]):
            if (ci, fi) in seen:
                continue
            di, gi = cell["neighbors"][fi], cell["otherFaces"][fi]
            partner = cells[di]
            if partner["neighbors"][gi] != ci or partner["otherFaces"][gi] != fi:
                raise ValueError("Face pairing is not an involution")
            seen.update(((ci, fi), (di, gi)))
            pairing = dict(zip(face, cell["vertexImages"][fi]))
            reverse = dict(zip(partner["faces"][gi], partner["vertexImages"][gi]))
            if set(pairing.values()) != set(partner["faces"][gi]):
                raise ValueError("Face pairing is not a vertex bijection")
            if any(reverse[pairing[v]] != v for v in face):
                raise ValueError("Paired face vertex maps are not inverse")
            cycle = _face_cycle(cell, face)
            for a, b in zip(cycle, cycle[1:] + cycle[:1]):
                ti = len(tetrahedra)
                tetrahedra.append(([None] * 4, [None] * 4))
                # Tet vertices: center(ci), center(di), a, b, where a,b
                # are labels in the ci chart of this face pair.
                radial[(ci, fi, a)].append((ti, 3, {0: 0, 1: 1, a + 2: 2}))
                radial[(ci, fi, b)].append((ti, 2, {0: 0, 1: 1, b + 2: 3}))
                halves[(ci, tuple(sorted((a, b))))].append((ti, 1, {"c": 0, a: 2, b: 3}))
                halves[(di, tuple(sorted((pairing[a], pairing[b]))))].append(
                    (ti, 0, {"c": 1, pairing[a]: 2, pairing[b]: 3}))

    def attach(entries):
        if len(entries) != 2:
            raise ValueError("Expected exactly two tetrahedra incident to a face")
        (ti, omitted, labels), (tj, other_omitted, other_labels) = entries
        if set(labels) != set(other_labels):
            raise ValueError("Inconsistent labels on shared face")
        perm = [None] * 4
        perm[omitted] = other_omitted
        for label, index in labels.items():
            perm[index] = other_labels[label]
        inv = [perm.index(i) for i in range(4)]
        tetrahedra[ti][0][omitted] = tj
        tetrahedra[ti][1][omitted] = perm
        tetrahedra[tj][0][other_omitted] = ti
        tetrahedra[tj][1][other_omitted] = inv

    for entries in radial.values():
        attach(entries)
    for entries in halves.values():
        attach(entries)
    if any(any(x is None for x in neighbors + permutations)
           for neighbors, permutations in tetrahedra):
        raise ValueError("Incomplete triangulation")
    return tetrahedra


def reconstruct_triangulation(cells):
    import snappy

    data = tetrahedral_gluing_data(cells)
    triangulation = snappy.Triangulation("empty")
    triangulation._from_tetrahedra_gluing_data(
        data,
        remove_finite_vertices=False,
    )
    return triangulation


def reconstruct_signature(cells):
    return reconstruct_triangulation(cells).triangulation_isosig(decorated=False)


if __name__ == "__main__":
    import json
    from pathlib import Path

    source = Path(__file__).resolve().parents[1] / "dodecahedral-data.json"
    data = json.loads(source.read_text())
    signature = reconstruct_signature(data["cells"])
    assert signature == data["provenance"]["isometrySignature"]
    print("Exported face pairings reconstruct the census canonical signature exactly.")
    print(signature)

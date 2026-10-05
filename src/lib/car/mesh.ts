import type { MaterialId, Solid, Vec3 } from "./types";

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Accumulates the vertices and faces of one solid.
 *
 * Normals are computed later by averaging the faces around each vertex, so sharing a vertex
 * between faces makes a smooth surface and giving each face its own vertices makes a crisp
 * edge. Every primitive chooses between the two by how it calls `vertex`.
 */
export class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];

  get count(): number {
    return this.positions.length / 3;
  }

  vertex(p: Vec3, u = 0, v = 0): number {
    this.positions.push(p[0], p[1], p[2]);
    this.uvs.push(u, v);
    return this.count - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  /** Four corners in order around the perimeter. */
  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d);
  }

  /**
   * Faces between consecutive rows of a vertex grid that was added row by row starting at
   * `first`. With `wrap`, the last column joins back to the first.
   */
  grid(first: number, rows: number, cols: number, wrap = false): void {
    const span = wrap ? cols : cols - 1;
    for (let j = 0; j < rows - 1; j++) {
      for (let k = 0; k < span; k++) {
        const a = first + j * cols + k;
        const b = first + j * cols + ((k + 1) % cols);
        this.quad(a, a + cols, b + cols, b);
      }
    }
  }

  build(material: MaterialId): Solid {
    return { positions: this.positions, indices: this.indices, uvs: this.uvs, material };
  }
}

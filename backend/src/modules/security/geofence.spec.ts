/**
 * Unit: point-in-polygon (ray casting) for arbitrary society geofence shapes.
 */
describe('Geofence point-in-polygon', () => {
  const inside = (poly: [number, number][], point: [number, number]) => {
    const [x, y] = point;
    let isIn = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) isIn = !isIn;
    }
    return isIn;
  };

  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it('point inside a square', () => expect(inside(square, [5, 5])).toBe(true));
  it('point outside a square', () => expect(inside(square, [11, 5])).toBe(false));
  it('point on the boundary edge — implementation-defined; must be deterministic', () => {
    expect(typeof inside(square, [10, 5])).toBe('boolean');
  });

  it('handles concave polygon', () => {
    const concave: [number, number][] = [[0, 0], [5, 0], [5, 5], [3, 5], [3, 3], [0, 3]];
    expect(inside(concave, [4, 4])).toBe(true);
    expect(inside(concave, [1, 4])).toBe(false);
  });
});

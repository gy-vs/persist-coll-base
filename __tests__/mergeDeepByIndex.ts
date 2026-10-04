import {
  fromJS,
  List,
  Map,
  mergeDeepByIndex,
  OrderedMap,
  Record,
  Set,
} from 'immutable';

describe('mergeDeepByIndex', () => {
  it('merges lists position by position instead of concatenating', () => {
    const base = List([Map({ id: 1, n: 'a' }), Map({ id: 2 })]);
    const override = List([Map({ n: 'b' })]);
    expect(base.mergeDeepByIndex(override)).toEqual(
      List([Map({ id: 1, n: 'b' }), Map({ id: 2 })])
    );
    expect(base.mergeDeepByIndex(override).size).toBe(2);
  });

  it('merges plain arrays position by position', () => {
    const base = { items: [{ id: 1, n: 'a' }, { id: 2 }] };
    const override = { items: [{ n: 'b' }] };
    expect(mergeDeepByIndex(base, override)).toEqual({
      items: [{ id: 1, n: 'b' }, { id: 2 }],
    });
  });

  it('appends extra source items and keeps trailing target items', () => {
    const base = List([Map({ a: 1 })]);
    const override = List([Map({ b: 2 }), Map({ c: 3 })]);
    expect(base.mergeDeepByIndex(override)).toEqual(
      List([Map({ a: 1, b: 2 }), Map({ c: 3 })])
    );

    const arrBase = [{ a: 1 }];
    const arrOverride = [{ b: 2 }, { c: 3 }];
    expect(mergeDeepByIndex(arrBase, arrOverride)).toEqual([
      { a: 1, b: 2 },
      { c: 3 },
    ]);
  });

  it('leaves trailing target items untouched when source is shorter', () => {
    const third = { id: 3 };
    const base = [{ id: 1 }, { id: 2 }, third];
    const result = mergeDeepByIndex(base, [{ n: 'x' }]);
    expect(result).toEqual([{ id: 1, n: 'x' }, { id: 2 }, { id: 3 }]);
    expect(result[2]).toBe(third);
  });

  it('folds multiple sources in order', () => {
    const base = { items: [{ a: 1 }, { b: 2 }] };
    const s1 = { items: [{ c: 3 }] };
    const s2 = { items: [{ a: 10 }, { d: 4 }] };
    expect(mergeDeepByIndex(base, s1, s2)).toEqual({
      items: [
        { a: 10, c: 3 },
        { b: 2, d: 4 },
      ],
    });
  });

  it('recurses through several nested levels of lists and arrays', () => {
    const base = fromJS({
      form: { items: [{ fields: [{ n: 'a', v: 1 }] }] },
    });
    const override = {
      form: { items: [{ fields: [{ v: 2 }] }] },
    };
    expect(base.mergeDeepByIndex(override).toJS()).toEqual({
      form: { items: [{ fields: [{ n: 'a', v: 2 }] }] },
    });
  });

  it('merges Lists mixed with plain arrays in both directions', () => {
    const listBase = List([{ a: 1 }, { b: 2 }]);
    expect(listBase.mergeDeepByIndex([{ c: 3 }]).toJS()).toEqual([
      { a: 1, c: 3 },
      { b: 2 },
    ]);

    const arrBase = [{ a: 1 }, { b: 2 }];
    const result = mergeDeepByIndex(arrBase, List([{ c: 3 }]));
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([{ a: 1, c: 3 }, { b: 2 }]);
  });

  it('keeps keyed merge semantics identical to mergeDeep', () => {
    const m1 = Map({ a: Map({ x: 1, y: 1 }), b: 2 });
    const m2 = Map({ a: Map({ y: 10, z: 20 }), c: 3 });
    expect(m1.mergeDeepByIndex(m2)).toEqual(m1.mergeDeep(m2));
    expect(m1.mergeDeepByIndex(m2)).toBeInstanceOf(Map);
  });

  it('is available on OrderedMap', () => {
    const om = OrderedMap({ items: List([Map({ a: 1 })]) });
    const result = om.mergeDeepByIndex({ items: [{ b: 2 }] });
    expect(OrderedMap.isOrderedMap(result)).toBe(true);
    expect(result.toJS()).toEqual({ items: [{ a: 1, b: 2 }] });
  });

  it('is available on Record', () => {
    const R = Record({ items: List([Map({ a: 1 })]), title: '' });
    const r = R();
    // @ts-expect-error -- deep merge widens nested List item types
    const result = r.mergeDeepByIndex({ items: List([Map({ b: 2 })]) });
    expect(result.items).toEqual(List([Map({ a: 1, b: 2 })]));
    expect(result.title).toBe('');
  });

  it('merges Sets as unions, same as mergeDeep', () => {
    const s1 = Set([1, 2, 3]);
    const s2 = Set([3, 4, 5]);
    expect(Set.isSet(mergeDeepByIndex(s1, s2))).toBe(true);
    expect(mergeDeepByIndex(s1, s2).sort()).toEqual(
      Set([1, 2, 3, 4, 5]).sort()
    );

    const nested = Map({ tags: Set(['x', 'y']) });
    expect(
      nested.mergeDeepByIndex({ tags: Set(['y', 'z']) }).get('tags')
    ).toEqual(Set(['x', 'y', 'z']));
    expect(nested.mergeDeepByIndex({ tags: Set(['x', 'y']) })).toBe(nested);
  });

  it('replaces instead of merging incompatible categories', () => {
    const base = Map({ a: List([1, 2]) });
    const override = Map({ a: Map({ x: 1 }) });
    expect(base.mergeDeepByIndex(override)).toEqual(override);

    const arrBase = { a: [1, 2] };
    const arrOverride = { a: { x: 1 } };
    expect(mergeDeepByIndex(arrBase, arrOverride)).toEqual({ a: { x: 1 } });
  });

  it('replaces a primitive item with the incoming value at the same index', () => {
    expect(mergeDeepByIndex([1, 2, 3], [10])).toEqual([10, 2, 3]);
    expect(
      List([1, 2, 3])
        .mergeDeepByIndex(List([10]))
        .toJS()
    ).toEqual([10, 2, 3]);
  });

  it('returns the original List reference when nothing changed', () => {
    const base = List([Map({ a: 1 }), Map({ b: 2 })]);
    expect(base.mergeDeepByIndex(List([Map({ a: 1 })]))).toBe(base);
    expect(base.mergeDeepByIndex(List())).toBe(base);
  });

  it('returns the original plain array/object reference when nothing changed', () => {
    const baseArr = [{ a: 1 }, { b: 2 }];
    expect(mergeDeepByIndex(baseArr, [{ a: 1 }])).toBe(baseArr);
    expect(mergeDeepByIndex(baseArr, [])).toBe(baseArr);

    const baseObj = { items: [{ a: 1 }], x: 1 };
    expect(mergeDeepByIndex(baseObj, { items: [{ a: 1 }] })).toBe(baseObj);
  });

  it('returns the original Map reference when nested lists are unchanged', () => {
    const base = Map({ items: List([Map({ a: 1 })]) });
    expect(base.mergeDeepByIndex(Map({ items: List([Map({ a: 1 })]) }))).toBe(
      base
    );
    const nested = fromJS({ a: { b: [{ c: 1 }] } });
    expect(nested.mergeDeepByIndex({ a: { b: [{ c: 1 }] } })).toBe(nested);
  });

  it('does not mutate nested unchanged arrays', () => {
    const inner = [{ z: 9 }];
    const base = { items: [{ a: 1 }, inner] };
    const result = mergeDeepByIndex(base, { items: [{ b: 2 }] });
    expect(result.items[1]).toBe(inner);
    expect(base).toEqual({ items: [{ a: 1 }, [{ z: 9 }]] });
  });

  it('returns arg when merging into an empty target', () => {
    const m1 = fromJS({ items: [{ a: 1 }] });
    expect(Map().mergeDeepByIndex(m1)).toBe(m1);
  });

  it('ignores null and undefined sources', () => {
    const base = { items: [{ a: 1 }] };
    expect(
      mergeDeepByIndex(base, null as never, undefined as never, null as never)
    ).toBe(base);

    const list = List([Map({ a: 1 })]);
    expect(list.mergeDeepByIndex(null as never, undefined as never)).toBe(list);

    const map = Map({ a: List([1]) });
    expect(map.mergeDeepByIndex(null as never, undefined as never)).toBe(map);
  });

  it('replaces with null when null appears at a nested index', () => {
    expect(mergeDeepByIndex([{ x: 1 }], [null])).toEqual([null]);
    expect(
      List([Map({ a: 1 })])
        .mergeDeepByIndex(List([null]))
        .toJS()
    ).toEqual([null]);
  });

  it('handles non-iterable sources at the top level like mergeDeep', () => {
    // List#concat treats non-iterable values and strings as one value.
    expect(List([1, 2]).mergeDeepByIndex('ab').toJS()).toEqual([1, 2, 'ab']);
    expect(
      List([1, 2])
        .mergeDeepByIndex({ x: 1 } as never)
        .toJS()
    ).toEqual([1, 2, { x: 1 }]);

    // A plain array target treats a string source as one appended value
    // (matching List#concat), while other non-iterable sources throw.
    expect(mergeDeepByIndex([1, 2], 'ab')).toEqual([1, 2, 'ab']);
    expect(() => mergeDeepByIndex([1, 2], { x: 1 } as never)).toThrow();
  });

  it('preserves references when every source is a no-op', () => {
    const base = fromJS({ items: [{ a: 1 }], meta: { v: 1 } });
    const result = base
      .mergeDeepByIndex({ items: [{ a: 1 }] })
      .mergeDeepByIndex({ meta: { v: 1 } });
    expect(result).toBe(base);
  });

  it('appends non-iterable array-like objects as a single value on a List', () => {
    const source: ArrayLike<{ c?: number; d?: number }> = {
      length: 2,
      0: { c: 3 },
      1: { d: 4 },
    };
    const result = List([1, 2]).mergeDeepByIndex(source);
    expect(result.size).toBe(3);
    expect(result.get(2)).toBe(source);
  });

  it('throws when merging into a non-data-structure', () => {
    expect(() => mergeDeepByIndex(1, { a: 2 })).toThrowError(TypeError);
  });
});

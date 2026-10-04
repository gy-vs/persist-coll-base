import {
  List,
  Map,
  OrderedMap,
  Record,
  Set,
  fromJS,
  mergeDeepByIndex,
} from '../src/Immutable';

describe('mergeDeepByIndex', () => {
  it('merges lists position by position instead of concatenating', () => {
    const target = { items: [{ id: 1, n: 'a' }, { id: 2 }] };
    const source = { items: [{ n: 'b' }] };
    expect(mergeDeepByIndex(target, source)).toEqual({
      items: [{ id: 1, n: 'b' }, { id: 2 }],
    });
  });

  it('recursively merges entries at the same index', () => {
    expect(
      mergeDeepByIndex({ a: [{ b: [1, 2] }, { b: [3] }] }, { a: [{ b: [10] }] })
    ).toEqual({ a: [{ b: [10, 2] }, { b: [3] }] });
  });

  it('appends extra trailing entries of longer sources', () => {
    expect(
      mergeDeepByIndex([{ a: 1 }, { a: 2 }], [{ a: 10 }, { a: 20 }, { a: 30 }])
    ).toEqual([{ a: 10 }, { a: 20 }, { a: 30 }]);
  });

  it('keeps trailing entries only present in a shorter target', () => {
    expect(
      mergeDeepByIndex([{ a: 1 }, { a: 2 }, { a: 3 }], [{ a: 10 }])
    ).toEqual([{ a: 10 }, { a: 2 }, { a: 3 }]);
  });

  it('applies multiple sources one after another', () => {
    expect(
      mergeDeepByIndex(
        { items: [{ a: 1 }, { a: 2 }] },
        { items: [{ a: 10 }] },
        { items: [{ a: 100 }, { a: 200 }, { a: 300 }] }
      )
    ).toEqual({ items: [{ a: 100 }, { a: 200 }, { a: 300 }] });
  });

  it('returns plain objects and arrays for plain input', () => {
    const result = mergeDeepByIndex(
      { items: [{ id: 1 }] },
      { items: [{ n: 'b' }] }
    );
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.constructor).toBe(Object);
    expect(result.items[0].constructor).toBe(Object);
  });

  it('merges mixed immutable Lists and plain arrays in both directions', () => {
    const target = Map({
      items: List([Map({ id: 1, n: 'a' }), Map({ id: 2 })]),
      tag: 'x',
    });
    const result = target.mergeDeepByIndex({ items: [{ n: 'b' }] });
    expect(List.isList(result.get('items'))).toBe(true);
    expect(Map.isMap(result.getIn(['items', 0]))).toBe(true);
    expect(result).toEqual(
      Map({
        items: List([Map({ id: 1, n: 'b' }), Map({ id: 2 })]),
        tag: 'x',
      })
    );

    const plain = { items: [{ id: 1, n: 'a' }, { id: 2 }] };
    const result2 = mergeDeepByIndex(plain, {
      items: List([Map({ n: 'b' })]),
    });
    expect(Array.isArray(result2.items)).toBe(true);
    expect(result2).toEqual({ items: [{ id: 1, n: 'b' }, { id: 2 }] });
  });

  it('works with fromJS structures merged with backend JSON', () => {
    const platform = fromJS({
      items: [{ id: 1, n: 'a' }, { id: 2 }],
    });
    const tenant = { items: [{ n: 'b' }] };
    const user = { items: [{}, { n: 'c' }] };
    const result = platform.mergeDeepByIndex(tenant, user);
    expect(result).toEqual(
      fromJS({
        items: [
          { id: 1, n: 'b' },
          { id: 2, n: 'c' },
        ],
      })
    );
  });

  it('is available on List', () => {
    const result = List([{ a: 1 }, { a: 2 }]).mergeDeepByIndex(
      List([{ a: 10 }])
    );
    expect(List.isList(result)).toBe(true);
    expect(result).toEqual(List([{ a: 10 }, { a: 2 }]));
  });

  it('is available on Map and OrderedMap', () => {
    const result = Map({
      items: List([Map({ n: 'a' }), Map({ n: 'c' })]),
    }).mergeDeepByIndex({ items: [{ n: 'b' }] });
    expect(result).toEqual(
      Map({ items: List([Map({ n: 'b' }), Map({ n: 'c' })]) })
    );

    const ordered = OrderedMap({
      items: List([Map({ n: 'a' }), Map({ n: 'c' })]),
    }).mergeDeepByIndex({ items: [{ n: 'b' }] });
    expect(OrderedMap.isOrderedMap(ordered)).toBe(true);
    expect(ordered).toEqual(
      OrderedMap({ items: List([Map({ n: 'b' }), Map({ n: 'c' })]) })
    );
  });

  it('is available on Records', () => {
    const R = Record({ items: List(), name: '' });
    const record = R({
      items: List([Map({ id: 1, n: 'a' }), Map({ id: 2 })]),
    });
    const result = record.mergeDeepByIndex({
      items: List([Map({ n: 'b' })]),
    });
    expect(result).toEqual(
      R({ items: List([Map({ id: 1, n: 'b' }), Map({ id: 2 })]) })
    );
  });

  it('still unions Sets like mergeDeep', () => {
    const result = Map({ s: Set([1, 2]) }).mergeDeepByIndex(
      Map({ s: Set([2, 3]) })
    );
    expect(result.get('s')).toEqual(Set([1, 2, 3]));

    expect(mergeDeepByIndex({ s: Set([1, 2]) }, { s: Set([2, 3]) }).s).toEqual(
      Set([1, 2, 3])
    );
  });

  it('merges keyed structures the same way mergeDeep does', () => {
    expect(
      mergeDeepByIndex(
        { a: { x: 1, y: 1 }, b: { x: 2 } },
        { a: { y: 50, z: 100 } }
      )
    ).toEqual({ a: { x: 1, y: 50, z: 100 }, b: { x: 2 } });
  });

  it('replaces values when indexed and keyed collections conflict', () => {
    // Incompatible categories are replaced, just like with mergeDeep.
    expect(mergeDeepByIndex({ a: [1, 2] }, { a: { x: 1 } })).toEqual({
      a: { x: 1 },
    });
    expect(mergeDeepByIndex({ a: { x: 1 } }, { a: [1, 2] })).toEqual({
      a: [1, 2],
    });
  });

  it('replaces non-data-structure values', () => {
    expect(mergeDeepByIndex({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    expect(mergeDeepByIndex([1, 2, 3], [10])).toEqual([10, 2, 3]);
  });

  it('returns the original reference when nothing changes (plain JS)', () => {
    const target = { items: [{ id: 1, n: 'a' }], b: { c: 1 } };
    expect(mergeDeepByIndex(target, { items: [{ id: 1, n: 'a' }] })).toBe(
      target
    );

    const array = [{ a: 1 }, { a: 2 }];
    expect(mergeDeepByIndex(array, [{ a: 1 }])).toBe(array);
    expect(mergeDeepByIndex(array, [])).toBe(array);

    const numbers = [1, 2, 3];
    expect(mergeDeepByIndex(numbers, [1, 2])).toBe(numbers);
  });

  it('returns the original reference when nothing changes (immutable)', () => {
    const target = fromJS({
      items: [{ id: 1, n: 'a' }, { id: 2 }],
      s: Set([1, 2]),
    });
    expect(target.mergeDeepByIndex({ items: [{ id: 1, n: 'a' }] })).toBe(
      target
    );
    expect(target.mergeDeepByIndex({ s: Set([1]) })).toBe(target);
    expect(target.mergeDeepByIndex({})).toBe(target);

    const list = List([Map({ a: 1 }), Map({ a: 2 })]);
    expect(list.mergeDeepByIndex(List([Map({ a: 1 })]))).toBe(list);
    expect(list.mergeDeepByIndex(List())).toBe(list);
    const emptyList = List();
    expect(emptyList.mergeDeepByIndex(List())).toBe(emptyList);

    const R = Record({ items: List() });
    const record = R({ items: List([Map({ a: 1 })]) });
    expect(record.mergeDeepByIndex({ items: List([Map({ a: 1 })]) })).toBe(
      record
    );
  });

  it('handles deeply nested lists several levels down', () => {
    const target = fromJS({
      level1: { level2: { items: [{ a: [1, 2] }, { a: [3] }] } },
    });
    const source = {
      level1: { level2: { items: [{ a: List([10, 2]) }] } },
    };
    const result = target.mergeDeepByIndex(source);
    expect(result).toEqual(
      fromJS({
        level1: { level2: { items: [{ a: [10, 2] }, { a: [3] }] } },
      })
    );
  });

  it('does not mutate its inputs', () => {
    const target = { items: [{ id: 1, n: 'a' }] };
    const source = { items: [{ n: 'b' }] };
    mergeDeepByIndex(target, source);
    expect(target).toEqual({ items: [{ id: 1, n: 'a' }] });
    expect(source).toEqual({ items: [{ n: 'b' }] });
  });

  it('position-merges Sets found inside lists', () => {
    const target = Map({ tags: List([Set([1, 2]), Set([9])]) });
    const result = target.mergeDeepByIndex({ tags: [Set([2, 3])] });
    expect(result).toEqual(Map({ tags: List([Set([1, 2, 3]), Set([9])]) }));
  });

  it('position-merges immutable entries inside plain arrays', () => {
    const target = [Map({ a: 1 }), Map({ b: 2 })];
    const result = mergeDeepByIndex(target, [{ a: 10 }]);
    expect(result).toEqual([Map({ a: 10 }), Map({ b: 2 })]);
    expect(Map.isMap(result[0])).toBe(true);
  });

  it('aligns successive sources by index as the list grows', () => {
    const target = List([Map({ a: 1 })]);
    const result = target.mergeDeepByIndex(
      List([Map({ a: 10 }), Map({ a: 20 })]),
      List([Map({ a: 100 }), Map({ a: 200 }), Map({ a: 300 })])
    );
    expect(result).toEqual(
      List([Map({ a: 100 }), Map({ a: 200 }), Map({ a: 300 })])
    );

    expect(
      mergeDeepByIndex([{ a: 1 }], List([Map({ a: 10 }), Map({ a: 20 })]))
    ).toEqual([{ a: 10 }, Map({ a: 20 })]);
  });
});

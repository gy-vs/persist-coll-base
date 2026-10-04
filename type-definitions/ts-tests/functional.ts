import { expect, test } from 'tstyche';
import {
  get,
  has,
  set,
  remove,
  update,
  List,
  Map,
  mergeDeepByIndex,
} from 'immutable';

test('get', () => {
  expect(get([1, 2, 3], 0)).type.toBe<number | undefined>();

  expect(get([1, 2, 3], 0, 'a')).type.toBe<number | 'a'>();

  expect(get({ x: 10, y: 20 }, 'x')).type.toBe<number | undefined>();

  expect(get({ x: 10, y: 20 }, 'z', 'missing')).type.toBe<number | 'missing'>();
});

test('has', () => {
  expect(has([1, 2, 3], 0)).type.toBeBoolean();

  expect(has({ x: 10, y: 20 }, 'x')).type.toBeBoolean();
});

test('set', () => {
  expect(set([1, 2, 3], 0, 10)).type.toBe<number[]>();

  expect(set([1, 2, 3], 0, 'a')).type.toRaiseError();

  expect(set([1, 2, 3], 'a', 0)).type.toRaiseError();

  expect(set({ x: 10, y: 20 }, 'x', 100)).type.toBe<{
    x: number;
    y: number;
  }>();

  expect(set({ x: 10, y: 20 }, 'x', 'a')).type.toRaiseError();
});

test('remove', () => {
  expect(remove([1, 2, 3], 0)).type.toBe<number[]>();

  expect(remove({ x: 10, y: 20 }, 'x')).type.toBe<{
    x: number;
    y: number;
  }>();
});

test('update', () => {
  expect(update([1, 2, 3], 0, (v: number) => v + 1)).type.toBe<number[]>();

  expect(update([1, 2, 3], 0, 1)).type.toRaiseError();

  expect(update([1, 2, 3], 0, (v: string) => v + 'a')).type.toRaiseError();

  expect(update([1, 2, 3], 'a', (v: number) => v + 1)).type.toRaiseError();

  expect(update({ x: 10, y: 20 }, 'x', (v: number) => v + 1)).type.toBe<{
    x: number;
    y: number;
  }>();

  expect(
    update({ x: 10, y: 20 }, 'x', (v: string) => v + 'a')
  ).type.toRaiseError();
});

test('mergeDeepByIndex', () => {
  const original = { items: [{ id: 1, name: 'a' }, { id: 2 }] };
  expect(mergeDeepByIndex(original, { items: [{ name: 'b' }] })).type.toBe<
    typeof original
  >();

  const numbers = [1, 2, 3];
  expect(mergeDeepByIndex(numbers, [10])).type.toBe<typeof numbers>();

  expect(
    mergeDeepByIndex(Map<string, number>(), Map<string, number>())
  ).type.toBe<Map<string, number>>();

  // The functional variants return the type of the first collection,
  // regardless of the sources (like `mergeDeep`).
  expect(mergeDeepByIndex(List<number>(), List<string>())).type.toBe<
    List<number>
  >();
});

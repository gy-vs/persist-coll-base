import { isImmutable } from '../predicates/isImmutable';
import { isIndexed } from '../predicates/isIndexed';
import { isKeyed } from '../predicates/isKeyed';
import { IndexedCollection, KeyedCollection } from '../Collection';
import { Seq } from '../Seq';
import { hasIterator } from '../Iterator';
import assertNotInfinite from '../utils/assertNotInfinite';
import hasOwnProperty from '../utils/hasOwnProperty';
import isDataStructure from '../utils/isDataStructure';
import shallowCopy from '../utils/shallowCopy';

export function mergeDeepByIndex(collection, ...sources) {
  return mergeDeepByIndexSources(collection, sources);
}

export function mergeDeepByIndexSources(collection, sources) {
  if (!isDataStructure(collection)) {
    throw new TypeError(
      'Cannot merge into non-data-structure value: ' + collection
    );
  }
  // Fold the sources one by one so a no-op merge keeps the original
  // reference all the way through.
  let merged = collection;
  for (let i = 0; i < sources.length; i++) {
    // As with mergeDeep, null and undefined sources are ignored entirely.
    if (sources[i] !== undefined && sources[i] !== null) {
      merged = mergeIntoByIndex(merged, sources[i]);
    }
  }
  return merged;
}

/**
 * Merges a single source into the target, using the category (keyed,
 * indexed, or set-like) of the target to decide how to iterate the source.
 * This mirrors the top level of mergeWithSources.
 */
function mergeIntoByIndex(oldValue, newValue) {
  if (isImmutable(oldValue)) {
    if (isIndexed(oldValue)) {
      return mergeImmutableIndexed(oldValue, newValue, true);
    }
    return typeof oldValue.mergeWith === 'function'
      ? oldValue.mergeWith(indexMerger, newValue)
      : oldValue.merge
      ? oldValue.merge(newValue)
      : oldValue.concat(newValue);
  }

  if (Array.isArray(oldValue)) {
    // Iterate the source as indexed values like mergeWithSources does. A
    // string is treated as a single appended value (matching List#concat's
    // argument coercion), while any other non-iterable source throws.
    const isSingleString = typeof newValue === 'string';
    const seq = IndexedCollection(isSingleString ? [newValue] : newValue);
    return mergeIndexedSeq(oldValue, seq, isSingleString ? oldValue.length : 0);
  }
  return mergePlainKeyed(oldValue, newValue);
}

/**
 * The nested merger: the two values are deep merged only when they are
 * compatible data structures, otherwise the new value wins. The only
 * difference from mergeDeep's deep merger is that compatible indexed
 * collections merge position by position instead of concatenating.
 */
function indexMerger(oldValue, newValue) {
  if (
    isDataStructure(oldValue) &&
    isDataStructure(newValue) &&
    areMergeable(oldValue, newValue)
  ) {
    if (isIndexed(Seq(oldValue))) {
      if (isImmutable(oldValue)) {
        return mergeImmutableIndexed(oldValue, newValue, false);
      }
      // A nested plain array target only accepts iterable indexed sources;
      // other data structures are incompatible and have already been
      // rejected by areMergeable, so IndexedCollection is safe here.
      return mergeIndexedSeq(oldValue, IndexedCollection(newValue), 0);
    }
    if (isImmutable(oldValue)) {
      return typeof oldValue.mergeWith === 'function'
        ? oldValue.mergeWith(indexMerger, newValue)
        : oldValue.merge
        ? oldValue.merge(newValue)
        : oldValue.concat(newValue);
    }
    return mergePlainKeyed(oldValue, newValue);
  }
  return newValue;
}

function mergePlainKeyed(oldObject, newObject) {
  let merged = oldObject;
  KeyedCollection(newObject).forEach((value, key) => {
    const hasVal = hasOwnProperty.call(merged, key);
    const nextVal = hasVal ? indexMerger(merged[key], value) : value;
    if (!hasVal || nextVal !== merged[key]) {
      // Copy on write
      if (merged === oldObject) {
        merged = shallowCopy(merged);
      }
      merged[key] = nextVal;
    }
  });
  return merged;
}

/**
 * Merges the items of a plain array target with an indexed source sequence,
 * position by position. When `offset` is non-zero (used for a non-iterable
 * source wrapped as a single value at the top level, matching List#concat),
 * the source items are appended starting at that position.
 */
function mergeIndexedSeq(oldArray, newSeq, offset) {
  let merged = oldArray;
  newSeq.forEach((newItem, index) => {
    const position = index + offset;
    if (position < oldArray.length) {
      const oldItem = oldArray[position];
      const nextItem = indexMerger(oldItem, newItem);
      if (nextItem !== oldItem) {
        // Copy on write
        if (merged === oldArray) {
          merged = shallowCopy(merged);
        }
        merged[position] = nextItem;
      }
    } else {
      // Copy on write
      if (merged === oldArray) {
        merged = shallowCopy(merged);
      }
      merged[position] = newItem;
    }
  });
  return merged;
}

/**
 * Indexed immutable collections (List, Stack) merge position by position.
 *
 * At the top level the source is coerced the same way List#concat coerces
 * its arguments: a non-iterable value or a string is treated as a single
 * value pushed to the end. At nested levels a non-indexed source is
 * category-incompatible and replaces the target, matching mergeDeep's
 * nested merger.
 */
function mergeImmutableIndexed(oldCollection, newCollection, topLevel) {
  let newSeq;
  let wrappedSingle = false;
  if (
    topLevel &&
    (typeof newCollection === 'string' || !hasIterator(newCollection))
  ) {
    newSeq = IndexedCollection([newCollection]);
    wrappedSingle = true;
  } else {
    newSeq = IndexedCollection(newCollection);
  }
  if (newSeq.size === 0) {
    return oldCollection;
  }

  const oldSeq = IndexedCollection(oldCollection);
  assertNotInfinite(oldSeq.size);
  assertNotInfinite(newSeq.size);

  const oldSize = oldSeq.size;
  const offset = wrappedSingle ? oldSize : 0;
  let changed = false;
  let items = null;

  newSeq.forEach((newItem, index) => {
    const position = index + offset;
    if (position < oldSize) {
      const oldItem = oldSeq.get(position);
      const nextItem = indexMerger(oldItem, newItem);
      if (nextItem !== oldItem) {
        // Copy on write
        if (!items) {
          items = oldSeq.toArray();
        }
        items[position] = nextItem;
        changed = true;
      }
    } else {
      // Copy on write
      if (!items) {
        items = oldSeq.toArray();
      }
      items[position] = newItem;
      changed = true;
    }
  });

  return changed ? new oldCollection.constructor(items) : oldCollection;
}

/**
 * It's unclear what the desired behavior is for merging two collections that
 * fall into separate categories between keyed, indexed, or set-like, so we only
 * consider them mergeable if they fall into the same category.
 */
function areMergeable(oldDataStructure, newDataStructure) {
  const oldSeq = Seq(oldDataStructure);
  const newSeq = Seq(newDataStructure);
  // This logic assumes that a sequence can only fall into one of the three
  // categories mentioned above (since there's no `isSetLike()` method).
  return (
    isIndexed(oldSeq) === isIndexed(newSeq) &&
    isKeyed(oldSeq) === isKeyed(newSeq)
  );
}

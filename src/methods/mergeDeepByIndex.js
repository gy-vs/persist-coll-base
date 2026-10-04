import { mergeDeepByIndexWithSources } from '../functional/merge';

export function mergeDeepByIndex(...iters) {
  return mergeDeepByIndexWithSources(this, iters);
}

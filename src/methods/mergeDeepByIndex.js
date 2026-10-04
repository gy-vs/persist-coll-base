import { mergeDeepByIndexSources } from '../functional/mergeDeepByIndex';

export function mergeDeepByIndex(...iters) {
  return mergeDeepByIndexSources(this, iters);
}

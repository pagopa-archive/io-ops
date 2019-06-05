type AsyncFunc<T, R> = (item: T) => Promise<R>;

/**
 * applies asyncFunc to each item and returns a promise with the array of results
 * @param items
 * @param asyncFunc
 * @param initialValue
 */
export function sequential<T, R>(
  items: ReadonlyArray<T>,
  asyncFunc: AsyncFunc<T, R>,
  initialValue: ReadonlyArray<R>
): Promise<ReadonlyArray<R>> {
  return items.reduce((prom, item) => {
    return prom.then(async acc => {
      const result = await asyncFunc(item);
      return [...acc, result];
    });
  }, Promise.resolve(initialValue)); // initial
}

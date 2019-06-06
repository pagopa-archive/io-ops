/**
 * applies asyncFunc to each item and returns a promise with the array of results
 * @param items
 * @param asyncFunc
 */
export function sequential<T, R>(
  items: ReadonlyArray<T>,
  asyncFunc: (item: T) => Promise<R>
): Promise<ReadonlyArray<R>> {
  return items.reduce(
    (prom, item) => prom.then(async acc => [...acc, await asyncFunc(item)]),
    Promise.resolve([] as ReadonlyArray<R>)
  );
}

export async function sequentialSum<T>(
  items: ReadonlyArray<T>,
  asyncFunc: (item: T) => Promise<number>
): Promise<number> {
  return sequential(items, asyncFunc).then(_ =>
    _.reduce((acc, curr) => acc + curr)
  );
}

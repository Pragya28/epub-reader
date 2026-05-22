import { create, type StateCreator } from "zustand";
import { devtools, persist, type PersistOptions } from "zustand/middleware";

type StoreOptions<T> = {
  name: string;
  persist?: PersistOptions<T>;
};

export function createStore<T>(
  store: StateCreator<T, [], []>,
  options: StoreOptions<T>,
) {
  if (options.persist) {
    return create<T>()(
      devtools(persist(store, options.persist), {
        name: options.name,
      }),
    );
  }

  return create<T>()(
    devtools(store, {
      name: options.name,
    }),
  );
}

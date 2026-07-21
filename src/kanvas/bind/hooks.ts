'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { DocStore } from './store'

export function useNodeIds(store: DocStore): string[] {
  const subscribe = useCallback((cb: () => void) => store.subscribeIds(cb), [store])
  const snapshot = useCallback(() => store.getIds(), [store])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function useNode(store: DocStore, id: string) {
  const subscribe = useCallback((cb: () => void) => store.subscribeNode(id, cb), [store, id])
  const snapshot = useCallback(() => store.getNode(id), [store, id])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

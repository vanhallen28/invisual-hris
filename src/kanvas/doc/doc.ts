import * as Y from 'yjs'
import { NODES_KEY, type YNode } from './types'

export function createEmptyDoc(): Y.Doc {
  return new Y.Doc()
}

/** Yjs mengembalikan instance yang sama untuk nama tipe yang sama. */
export function nodesMap(doc: Y.Doc): Y.Map<YNode> {
  return doc.getMap<YNode>(NODES_KEY)
}

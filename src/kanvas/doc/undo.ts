import * as Y from 'yjs'
import { nodesMap } from './doc'

/**
 * trackedOrigins dibatasi ke 'local' supaya update yang tiba dari
 * jaringan tidak masuk tumpukan undo. Tanpa ini, Ctrl+Z akan
 * membatalkan pekerjaan rekan satu tim.
 *
 * captureTimeout 500 ms menggabungkan operasi yang berdekatan menjadi
 * satu langkah, sehingga satu drag yang menghasilkan puluhan commit
 * tetap terasa seperti satu aksi.
 */
export function createUndoManager(doc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager(nodesMap(doc), {
    trackedOrigins: new Set(['local']),
    captureTimeout: 500,
  })
}

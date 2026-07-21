export function formatFileName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) throw new Error('Nama file tidak boleh kosong')
  return trimmed
}

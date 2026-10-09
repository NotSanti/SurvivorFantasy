const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_INPUT_BYTES = 8 * 1024 * 1024
const OUTPUT_SIZE = 256

function mimeFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return ''
}

/** Cover-crop to a square WebP so the circle and the storage bucket stay small. */
export async function cropAvatarFile(file: File): Promise<Blob> {
  const type = file.type || mimeFromName(file.name)
  if (!ACCEPTED.has(type)) {
    throw new Error('Use a JPEG, PNG, or WebP image.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That image is too large.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Could not read that image.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not prepare that image.')
  }

  const scale = Math.max(
    OUTPUT_SIZE / bitmap.width,
    OUTPUT_SIZE / bitmap.height,
  )
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  ctx.drawImage(
    bitmap,
    (OUTPUT_SIZE - width) / 2,
    (OUTPUT_SIZE - height) / 2,
    width,
    height,
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.9)
  })
  if (!blob) throw new Error('Could not prepare that image.')
  return blob
}

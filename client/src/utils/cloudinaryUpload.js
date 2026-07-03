export const uploadToCloudinary = async (file) => {
  if (!file) throw new Error('Select a file first.')

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary client env is missing.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed.')
  }

  return {
    url: data.secure_url,
    public_id: data.public_id,
    original_filename: data.original_filename,
    resource_type: data.resource_type,
    format: data.format,
  }
}

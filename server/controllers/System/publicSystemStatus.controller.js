import { getSystemAvailability } from '../../services/systemAvailability.service.js'

export const getPublicSystemStatus = async (_req, res) => {
  res.set('Cache-Control', 'no-store')

  try {
    const availability = await getSystemAvailability()
    return res.json(availability)
  } catch (error) {
    console.error('Public system status failed:', error.message)

    return res.status(503).json({
      code: 'SERVER_UNAVAILABLE',
      status: 'unavailable',
      message: 'The server is temporarily unavailable.',
    })
  }
}



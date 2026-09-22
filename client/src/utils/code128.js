// Minimal Code 128-B encoder/decoder used by employee barcode generation and
// the camera-scanner fallback. Keeping this local means camera attendance does
// not depend on the browser's BarcodeDetector API or a third-party CDN.

export const CODE128_PATTERNS = Object.freeze([
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
])

const START_B = 104
const STOP = 106
const QUIET_ZONE_MODULES = 10

const cleanText = (value) => String(value ?? '').trim()

export const normalizeEmployeeBarcodeCode = (value) => cleanText(value).toUpperCase()

export const validateCode128BText = (value) => {
  const text = cleanText(value)
  if (!text) return { valid: false, message: 'Enter a barcode code.' }
  for (const character of text) {
    const code = character.charCodeAt(0)
    if (code < 32 || code > 126) {
      return { valid: false, message: 'Barcode Code supports standard letters, numbers, spaces, and symbols only.' }
    }
  }
  return { valid: true, message: '' }
}

export const encodeCode128B = (value) => {
  const text = cleanText(value)
  const validation = validateCode128BText(text)
  if (!validation.valid) throw new Error(validation.message)

  const dataValues = Array.from(text, (character) => character.charCodeAt(0) - 32)
  let checksum = START_B
  dataValues.forEach((item, index) => { checksum += item * (index + 1) })
  checksum %= 103

  return [START_B, ...dataValues, checksum, STOP]
}

export const buildCode128Geometry = (value, { quietZone = QUIET_ZONE_MODULES } = {}) => {
  const symbols = encodeCode128B(value)
  const bars = []
  let cursor = Number(quietZone) || QUIET_ZONE_MODULES

  symbols.forEach((symbol) => {
    const pattern = CODE128_PATTERNS[symbol]
    Array.from(pattern).forEach((digit, index) => {
      const width = Number(digit)
      if (index % 2 === 0) bars.push({ x: cursor, width })
      cursor += width
    })
  })

  return {
    bars,
    moduleWidth: cursor + (Number(quietZone) || QUIET_ZONE_MODULES),
    quietZone: Number(quietZone) || QUIET_ZONE_MODULES,
  }
}

const patternNumbers = CODE128_PATTERNS.map((pattern) => Array.from(pattern, Number))

const normalizedPatternError = (runs, pattern) => {
  if (!Array.isArray(runs) || runs.length !== pattern.length) return Number.POSITIVE_INFINITY
  const patternTotal = pattern.reduce((sum, value) => sum + value, 0)
  const runTotal = runs.reduce((sum, value) => sum + value, 0)
  if (runTotal <= 0) return Number.POSITIVE_INFINITY
  const scale = runTotal / patternTotal
  if (scale < 0.35) return Number.POSITIVE_INFINITY

  let squared = 0
  for (let index = 0; index < pattern.length; index += 1) {
    const moduleEstimate = runs[index] / scale
    const delta = moduleEstimate - pattern[index]
    squared += delta * delta
  }
  return Math.sqrt(squared / pattern.length)
}

const bestSymbolMatch = (runs, maxSymbol = 105) => {
  let best = { symbol: -1, error: Number.POSITIVE_INFINITY }
  for (let symbol = 0; symbol <= maxSymbol; symbol += 1) {
    const error = normalizedPatternError(runs, patternNumbers[symbol])
    if (error < best.error) best = { symbol, error }
  }
  return best
}

const verifyAndDecodeCode128B = (symbols) => {
  if (!Array.isArray(symbols) || symbols.length < 3 || symbols[0] !== START_B) return null
  const checksumValue = symbols[symbols.length - 1]
  const dataValues = symbols.slice(1, -1)
  if (dataValues.some((value) => value < 0 || value > 94)) return null

  let checksum = START_B
  dataValues.forEach((value, index) => { checksum += value * (index + 1) })
  if ((checksum % 103) !== checksumValue) return null

  return dataValues.map((value) => String.fromCharCode(value + 32)).join('')
}

const compactTinyRuns = (runs, tinyThreshold = 0) => {
  if (runs.length < 3) return runs
  const result = runs.map((item) => ({ ...item }))
  let changed = true
  while (changed) {
    changed = false
    for (let index = 1; index < result.length - 1; index += 1) {
      if (result[index].length > tinyThreshold) continue
      if (result[index - 1].dark !== result[index + 1].dark) continue
      result[index - 1].length += result[index].length + result[index + 1].length
      result.splice(index, 2)
      changed = true
      break
    }
  }
  return result
}

export const decodeCode128BRuns = (inputRuns) => {
  const runs = compactTinyRuns(inputRuns)
  if (runs.length < 20) return null

  // The start pattern begins with a dark bar. Search the scanline so the barcode
  // can sit anywhere inside the camera frame.
  for (let startIndex = 0; startIndex <= runs.length - 20; startIndex += 1) {
    if (!runs[startIndex]?.dark) continue
    const startRuns = runs.slice(startIndex, startIndex + 6).map((item) => item.length)
    const startError = normalizedPatternError(startRuns, patternNumbers[START_B])
    if (startError > 0.55) continue

    const symbols = [START_B]
    let cursor = startIndex + 6
    let guard = 0

    while (cursor < runs.length - 6 && guard < 96) {
      guard += 1
      if (!runs[cursor]?.dark) break

      if (cursor + 7 <= runs.length) {
        const stopRuns = runs.slice(cursor, cursor + 7).map((item) => item.length)
        const stopError = normalizedPatternError(stopRuns, patternNumbers[STOP])
        const stopScale = stopRuns.reduce((sum, value) => sum + value, 0) / 13
        const followingRun = runs[cursor + 7]
        const hasStopBoundary = cursor + 7 === runs.length
          || (followingRun && !followingRun.dark && followingRun.length >= stopScale * 4)
        if (stopError <= 0.62 && hasStopBoundary) {
          const decoded = verifyAndDecodeCode128B(symbols)
          if (decoded) return decoded
          break
        }
      }

      if (cursor + 6 > runs.length) break
      const currentRuns = runs.slice(cursor, cursor + 6).map((item) => item.length)
      const match = bestSymbolMatch(currentRuns)
      if (match.symbol < 0 || match.error > 0.62) break
      symbols.push(match.symbol)
      cursor += 6
    }
  }

  return null
}

const percentile = (values, ratio) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))
  return sorted[index]
}

const rowToRuns = (imageData, width, y) => {
  const startX = Math.floor(width * 0.03)
  const endX = Math.ceil(width * 0.97)
  const luminance = []

  for (let x = startX; x < endX; x += 1) {
    const offset = ((y * width) + x) * 4
    const r = imageData.data[offset]
    const g = imageData.data[offset + 1]
    const b = imageData.data[offset + 2]
    luminance.push((r * 0.299) + (g * 0.587) + (b * 0.114))
  }

  const darkLevel = percentile(luminance, 0.12)
  const lightLevel = percentile(luminance, 0.88)
  if ((lightLevel - darkLevel) < 45) return []
  const threshold = darkLevel + ((lightLevel - darkLevel) * 0.48)

  const binary = luminance.map((value) => value < threshold)
  const runs = []
  let current = binary[0]
  let length = 1
  for (let index = 1; index < binary.length; index += 1) {
    if (binary[index] === current) {
      length += 1
    } else {
      runs.push({ dark: current, length })
      current = binary[index]
      length = 1
    }
  }
  runs.push({ dark: current, length })
  return runs
}

export const decodeCode128FromImageData = (imageData, width, height) => {
  const rowRatios = [0.50, 0.46, 0.54, 0.42, 0.58, 0.38, 0.62]
  for (const ratio of rowRatios) {
    const y = Math.max(0, Math.min(height - 1, Math.floor(height * ratio)))
    const decoded = decodeCode128BRuns(rowToRuns(imageData, width, y))
    if (decoded) return decoded
  }
  return null
}

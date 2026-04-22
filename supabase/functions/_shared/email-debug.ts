export const RECOVERY_DEBUG_STRINGS = [
  'Фонд «Лига»',
  'жертвователя',
  'Фонд Лига',
  'Фонд "Лига"',
  'личный кабинет жертвователя',
  'личном кабинете',
] as const

const FLAGGED_CODE_POINTS = new Set([0xfffd, 0x200b, 0x00a0])

interface EmailDebugPayloadArgs {
  emailType: string
  subject: string
  siteName?: string
  brandName?: string
  html: string
  text?: string
}

const extractFragment = (source: string, needle: string, radius = 160) => {
  const index = source.indexOf(needle)

  if (index === -1) return null

  const start = Math.max(0, index - radius)
  const end = Math.min(source.length, index + needle.length + radius)

  return source.slice(start, end)
}

export const inspectString = (value?: string | null) => {
  if (!value) {
    return {
      value,
      length: 0,
      hasFlaggedCharacters: false,
      flaggedCharacters: [],
      codePoints: [],
    }
  }

  const chars = Array.from(value)
  const flaggedCharacters = chars
    .filter((char) => FLAGGED_CODE_POINTS.has(char.codePointAt(0) ?? 0))
    .map((char) => ({ char, codePoint: `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}` }))

  return {
    value,
    length: chars.length,
    hasFlaggedCharacters: flaggedCharacters.length > 0,
    flaggedCharacters,
    codePoints: chars.map((char) => ({ char, codePoint: `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}` })),
  }
}

export const buildRenderDiagnostics = ({
  label,
  jsx,
  expected,
  html,
  text,
}: {
  label: string
  jsx: string
  expected: string
  html: string
  text?: string
}) => ({
  label,
  jsx,
  expected: inspectString(expected),
  hasReplacementCharacter: {
    html: html.includes('�'),
    text: text?.includes('�') ?? false,
  },
  containsExpected: {
    html: html.includes(expected),
    text: text?.includes(expected) ?? false,
  },
  htmlFragment: extractFragment(html, expected),
  textFragment: text ? extractFragment(text, expected) : null,
  htmlFirstReplacementFragment: extractFragment(html, '�'),
  textFirstReplacementFragment: text ? extractFragment(text, '�') : null,
})

export const buildEmailDebugPayload = ({ emailType, subject, siteName, brandName, html, text }: EmailDebugPayloadArgs) => {
  const stringsToInspect = Array.from(
    new Set([
      subject,
      siteName,
      brandName,
      ...RECOVERY_DEBUG_STRINGS,
    ].filter((value): value is string => Boolean(value)))
  )

  return {
    emailType,
    subject,
    siteName,
    brandName,
    hasReplacementCharacter: {
      subject: subject.includes('�'),
      siteName: siteName?.includes('�') ?? false,
      brandName: brandName?.includes('�') ?? false,
      html: html.includes('�'),
      text: text?.includes('�') ?? false,
    },
    inspectedStrings: stringsToInspect,
    htmlFragments: Object.fromEntries(
      stringsToInspect.map((needle) => [needle, extractFragment(html, needle)])
    ),
    textFragments: Object.fromEntries(
      stringsToInspect.map((needle) => [needle, text ? extractFragment(text, needle) : null])
    ),
    html,
    text,
  }
}

const REPLACEMENT_CHAR = '\uFFFD'

export const sha256Hex = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const countOccurrences = (value: string, needle: string) => {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while ((idx = value.indexOf(needle, idx)) !== -1) {
    count += 1
    idx += needle.length
  }
  return count
}

const replacementOffsets = (value: string, max = 10) => {
  const offsets: Array<{ index: number; fragment: string }> = []
  let idx = 0
  while (offsets.length < max && (idx = value.indexOf(REPLACEMENT_CHAR, idx)) !== -1) {
    const start = Math.max(0, idx - 80)
    const end = Math.min(value.length, idx + 80)
    offsets.push({ index: idx, fragment: value.slice(start, end) })
    idx += 1
  }
  return offsets
}

export interface OutboundEmailSnapshot {
  capturedAt: string
  emailType: string
  templateVersion: string
  runId?: string
  messageId?: string
  subject: string
  to?: string
  from?: string
  senderDomain?: string
  html: string
  text: string
}

export interface RenderedEmailSnapshot {
  emailType: string
  templateVersion: string
  subject: string
  html: string
  text: string
}

const inspectField = async (value: string) => ({
  length: value.length,
  byteLength: new TextEncoder().encode(value).length,
  sha256: await sha256Hex(value),
  replacementCount: countOccurrences(value, REPLACEMENT_CHAR),
  replacementOffsets: replacementO
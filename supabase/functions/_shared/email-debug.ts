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
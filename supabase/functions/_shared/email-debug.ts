export const RECOVERY_DEBUG_STRINGS = [
  'Фонд «Лига»',
  'жертвователя',
  'личный кабинет жертвователя',
  'личном кабинете',
] as const

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
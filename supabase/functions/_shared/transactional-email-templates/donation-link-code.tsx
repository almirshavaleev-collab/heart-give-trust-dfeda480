import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Лига Добра'

interface DonationLinkCodeProps {
  code?: string
  name?: string
}

const DonationLinkCodeEmail = ({ code, name }: DonationLinkCodeProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>Код подтверждения для привязки пожертвований — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Здравствуйте, ${name}!` : 'Здравствуйте!'}
        </Heading>
        <Text style={text}>
          Вы запросили код подтверждения, чтобы привязать прошлые пожертвования к своему личному кабинету в фонде «{SITE_NAME}».
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code ?? '——————'}</Text>
        </Section>
        <Text style={text}>
          Введите этот код в личном кабинете в течение <b>15 минут</b>. Если вы не запрашивали код — просто проигнорируйте это письмо, никаких действий не требуется.
        </Text>
        <Text style={hint}>
          В целях безопасности код действителен только один раз и только для вашего аккаунта.
        </Text>
        <Text style={footer}>С уважением, команда фонда «{SITE_NAME}»</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DonationLinkCodeEmail,
  subject: 'Код подтверждения для привязки пожертвований',
  displayName: 'Код привязки пожертвований',
  previewData: { code: '482915', name: 'Иван' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 28px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0B1F3A',
  margin: '0 0 20px',
  lineHeight: 1.3,
}
const text = {
  fontSize: '15px',
  color: '#0B1F3A',
  lineHeight: 1.6,
  margin: '0 0 18px',
}
const codeBox = {
  backgroundColor: '#F5F7FA',
  border: '1px solid #E5E9F0',
  borderRadius: '16px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
}
const codeText = {
  fontSize: '34px',
  fontWeight: 700,
  letterSpacing: '8px',
  color: '#0B1F3A',
  margin: 0,
  fontFamily: 'monospace',
}
const hint = {
  fontSize: '13px',
  color: '#5A6B82',
  lineHeight: 1.5,
  margin: '0 0 24px',
}
const footer = {
  fontSize: '13px',
  color: '#8A95A6',
  margin: '32px 0 0',
}
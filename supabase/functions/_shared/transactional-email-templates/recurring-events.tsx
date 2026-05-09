import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BRAND_NAME, BRAND_SIGNATURE } from '../brand.ts'

interface BaseProps {
  name?: string | null
  amount?: number
  currency?: string
  next_payment_at?: string
  card_last4?: string | null
  reason?: string
  retry_count?: number
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 28px' }
const header = { borderBottom: '3px solid #F5C24A', paddingBottom: '16px', marginBottom: '32px' }
const brand = { fontSize: '18px', fontWeight: 700, color: '#0B1F3A', letterSpacing: '0.5px', margin: 0 }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0B1F3A', margin: '0 0 20px', lineHeight: 1.3 }
const text = { fontSize: '15px', color: '#0B1F3A', lineHeight: 1.6, margin: '0 0 14px' }
const hint = { fontSize: '13px', color: '#5A6B82', lineHeight: 1.5, margin: '8px 0 18px' }
const footer = { fontSize: '13px', color: '#8A95A6', margin: '32px 0 0' }
const card = { backgroundColor: '#F5F7FA', border: '1px solid #E5E9F0', borderRadius: '16px', padding: '20px 24px', margin: '20px 0' }

const fmtAmount = (n?: number, c?: string) =>
  typeof n === 'number' ? `${new Intl.NumberFormat('ru-RU').format(n)} ${c ?? 'RUB'}` : '—'
const fmtDate = (s?: string) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

function Wrap({ title, preview, children }: { title: string; preview: string; children: React.ReactNode }) {
  return (
    <Html lang="ru" dir="ltr">
      <Head>
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta charSet="utf-8" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}><Text style={brand}>{BRAND_NAME}</Text></Section>
          <Heading style={h1}>{title}</Heading>
          {children}
          <Text style={footer}>С уважением, {BRAND_SIGNATURE}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const Succeeded = ({ name, amount, currency, next_payment_at, card_last4 }: BaseProps) => (
  <Wrap title={name ? `Спасибо, ${name}!` : 'Спасибо за поддержку!'}
        preview={`Регулярная поддержка — успешное списание ${fmtAmount(amount, currency)}`}>
    <Text style={text}>Мы получили ваш регулярный взнос — благодарим за поддержку фонда.</Text>
    <Section style={card}>
      <Text style={text}><b>Сумма:</b> {fmtAmount(amount, currency)}</Text>
      {card_last4 && <Text style={text}><b>Карта:</b> •••• {card_last4}</Text>}
      <Text style={text}><b>Следующее списание:</b> {fmtDate(next_payment_at)}</Text>
    </Section>
    <Text style={hint}>Вы можете изменить или приостановить регулярную поддержку в личном кабинете в любой момент.</Text>
  </Wrap>
)

const RetryScheduled = ({ name, retry_count }: BaseProps) => (
  <Wrap title={name ? `${name}, не удалось списать платёж` : 'Не удалось списать платёж'}
        preview="Мы попробуем повторить регулярное списание автоматически">
    <Text style={text}>Не удалось провести очередное списание по вашей регулярной поддержке.</Text>
    <Text style={text}>Не волнуйтесь — мы автоматически повторим попытку в течение 24 часов.</Text>
    {typeof retry_count === 'number' && (
      <Text style={hint}>Попытка №{retry_count}</Text>
    )}
    <Text style={hint}>Если списания продолжат не проходить, мы временно приостановим регулярную поддержку и пришлём отдельное письмо.</Text>
  </Wrap>
)

const Paused = ({ name, reason }: BaseProps) => (
  <Wrap title={name ? `${name}, регулярная поддержка приостановлена` : 'Регулярная поддержка приостановлена'}
        preview="Обновите данные карты, чтобы возобновить регулярную поддержку">
    <Text style={text}>Мы временно приостановили вашу регулярную поддержку — последние списания не прошли.</Text>
    {reason && <Text style={hint}>Причина: {reason}</Text>}
    <Text style={text}>Чтобы возобновить, пожалуйста, обновите данные карты в личном кабинете и оформите регулярную поддержку заново.</Text>
  </Wrap>
)

const Recovered = ({ name, amount, currency, next_payment_at }: BaseProps) => (
  <Wrap title={name ? `${name}, регулярная поддержка восстановлена` : 'Регулярная поддержка восстановлена'}
        preview="Списание прошло — регулярная поддержка снова активна">
    <Text style={text}>Спасибо! Очередное списание прошло успешно, ваша регулярная поддержка снова активна.</Text>
    <Section style={card}>
      <Text style={text}><b>Сумма:</b> {fmtAmount(amount, currency)}</Text>
      <Text style={text}><b>Следующее списание:</b> {fmtDate(next_payment_at)}</Text>
    </Section>
  </Wrap>
)

export const succeededTemplate = {
  component: Succeeded,
  subject: `Спасибо за регулярную поддержку — ${BRAND_NAME}`,
  displayName: 'Регулярная поддержка — успешное списание',
  previewData: { name: 'Иван', amount: 1000, currency: 'RUB', next_payment_at: new Date(Date.now() + 30 * 86400e3).toISOString(), card_last4: '4242' },
} satisfies TemplateEntry

export const retryTemplate = {
  component: RetryScheduled,
  subject: `Не удалось списать платёж — ${BRAND_NAME}`,
  displayName: 'Регулярная поддержка — повтор попытки',
  previewData: { name: 'Иван', retry_count: 1 },
} satisfies TemplateEntry

export const pausedTemplate = {
  component: Paused,
  subject: `Регулярная поддержка приостановлена — ${BRAND_NAME}`,
  displayName: 'Регулярная поддержка — приостановлена',
  previewData: { name: 'Иван', reason: 'expired_card' },
} satisfies TemplateEntry

export const recoveredTemplate = {
  component: Recovered,
  subject: `Регулярная поддержка восстановлена — ${BRAND_NAME}`,
  displayName: 'Регулярная поддержка — восстановлена',
  previewData: { name: 'Иван', amount: 1000, currency: 'RUB', next_payment_at: new Date(Date.now() + 30 * 86400e3).toISOString() },
} satisfies TemplateEntry

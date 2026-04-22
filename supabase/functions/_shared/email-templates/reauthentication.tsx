/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { BRAND_NAME, BRAND_SIGNATURE } from '../brand.ts'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface Props { token: string }

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="ru" dir="ltr">
    <Head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta charSet="utf-8" />
    </Head>
    <Preview>Код подтверждения личности для фонда «Лига»</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{BRAND_NAME}</Text></Section>
        <Heading style={h1}>Подтверждение личности</Heading>
        <Text style={text}>Используйте код ниже, чтобы подтвердить, что это вы:</Text>
        <Text style={footerMeta}>Вы получили это письмо, потому что выполняете защищённое действие в личном кабинете фонда «Лига».</Text>
        <Section style={codeBox}><Text style={codeStyle}>{token}</Text></Section>
        <Text style={footer}>
          Код действует ограниченное время. Если вы не запрашивали подтверждение, просто проигнорируйте письмо.
        </Text>
        <Text style={signature}>С теплом,</Text>
        <Text style={signature}>{BRAND_SIGNATURE}</Text>
      </Container>
    </Body>
  </Html>
)
export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header = { borderBottom: '3px solid #F5C24A', paddingBottom: '16px', marginBottom: '32px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#0B1F3A', letterSpacing: '0.5px', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0B1F3A', margin: '0 0 24px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#0B1F3A', lineHeight: '1.6', margin: '0 0 16px' }
const codeBox = { backgroundColor: '#F5F7FA', borderRadius: '16px', padding: '24px', textAlign: 'center' as const, margin: '24px 0' }
const codeStyle = { fontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace', fontSize: '32px', fontWeight: 'bold' as const, color: '#0B1F3A', letterSpacing: '8px', margin: 0 }
const footer = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '32px 0 16px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }
const footerMeta = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 24px' }
const signature = { fontSize: '13px', color: '#0B1F3A', margin: '16px 0 0' }

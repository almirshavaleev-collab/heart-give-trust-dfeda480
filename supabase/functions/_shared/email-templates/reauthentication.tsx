/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>Ваш код подтверждения</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Подтверждение действия</Heading>
        <Text style={text}>Используйте код ниже, чтобы подтвердить личность:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Код действует ограниченное время. Если вы не запрашивали его, проигнорируйте письмо.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0B1F3A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: "'Courier New', monospace",
  fontSize: '28px', fontWeight: 700 as const, color: '#0B1F3A',
  letterSpacing: '4px', margin: '0 0 30px',
  padding: '16px 20px', backgroundColor: '#F5F7FA', borderRadius: '16px',
  textAlign: 'center' as const,
}
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0', lineHeight: '1.5' }

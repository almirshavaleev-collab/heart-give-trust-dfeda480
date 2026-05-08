/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>Ссылка для входа в {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ссылка для входа</Heading>
        <Text style={text}>
          Нажмите кнопку ниже, чтобы войти в {siteName}. Ссылка действует ограниченное время.
        </Text>
        <Button style={button} href={confirmationUrl}>Войти</Button>
        <Text style={footer}>
          Если вы не запрашивали ссылку, просто проигнорируйте это письмо.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0B1F3A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const button = {
  backgroundColor: '#0B1F3A', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const,
  borderRadius: '16px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block',
}
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0', lineHeight: '1.5' }

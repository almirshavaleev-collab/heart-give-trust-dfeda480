/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { BRAND_NAME, BRAND_SIGNATURE } from '../brand.ts'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface Props { siteName: string; email: string; newEmail: string; confirmationUrl: string }

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: Props) => (
  <Html lang="ru" dir="ltr">
    <Head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta charSet="utf-8" />
    </Head>
    <Preview>Подтверждение смены email для фонда «Лига»</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{BRAND_NAME}</Text></Section>
        <Heading style={h1}>Подтвердите смену email</Heading>
        <Text style={text}>Вы запросили изменение адреса электронной почты для вашего аккаунта.</Text>
        <Text style={footerMeta}>Система фонда: {siteName}</Text>
        <Text style={text}>Текущий адрес:</Text>
        <Text style={text}><Link href={`mailto:${email}`} style={link}>{email}</Link></Text>
        <Text style={text}>Новый адрес:</Text>
        <Text style={text}><Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link></Text>
        <Text style={text}>Нажмите кнопку ниже, чтобы подтвердить изменение:</Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button style={button} href={confirmationUrl}>Подтвердить смену email</Button>
        </Section>
        <Text style={textSmall}>
          Если кнопка не работает, скопируйте ссылку в браузер:<br />
          <Link href={confirmationUrl} style={linkPlain}>{confirmationUrl}</Link>
        </Text>
        <Text style={footer}>
          Если вы не запрашивали изменение, срочно защитите свой аккаунт — смените пароль.
        </Text>
        <Text style={signature}>С теплом,<br />{BRAND_SIGNATURE}</Text>
      </Container>
    </Body>
  </Html>
)
export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header = { borderBottom: '3px solid #F5C24A', paddingBottom: '16px', marginBottom: '32px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#0B1F3A', letterSpacing: '0.5px', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0B1F3A', margin: '0 0 24px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#0B1F3A', lineHeight: '1.6', margin: '0 0 16px' }
const textSmall = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '24px 0', wordBreak: 'break-all' as const }
const link = { color: '#0B1F3A', textDecoration: 'underline' }
const linkPlain = { color: '#0B1F3A', textDecoration: 'underline', fontSize: '12px' }
const button = { backgroundColor: '#0B1F3A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '16px', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '32px 0 16px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }
const footerMeta = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 16px' }
const signature = { fontSize: '13px', color: '#0B1F3A', margin: '16px 0 0' }

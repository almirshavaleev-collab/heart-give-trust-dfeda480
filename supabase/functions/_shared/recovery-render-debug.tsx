import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { BRAND_NAME } from './brand.ts'
import { RecoveryEmail } from './email-templates/recovery.tsx'

const recoveryDiagnosticStrings = {
  minimal: 'Восстановление пароля',
  brandPlain: 'Фонд Лига',
  brandQuoted: 'Фонд «Лига»',
  brandAsciiQuoted: 'Фонд "Лига"',
  cabinet: 'личный кабинет',
  donorCabinet: 'личный кабинет жертвователя',
  hardcodedSentence: 'Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете Фонд «Лига».',
  sentencePrefix: 'Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ',
}

const recoveryStyles = {
  main: { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', margin: 0, padding: 0 },
  container: { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' },
  header: { borderBottom: '3px solid #F5C24A', paddingBottom: '16px', marginBottom: '32px' },
  brand: { fontSize: '18px', fontWeight: 'bold' as const, color: '#0B1F3A', letterSpacing: '0.5px', margin: 0 },
  h1: { fontSize: '24px', fontWeight: 'bold' as const, color: '#0B1F3A', margin: '0 0 24px', lineHeight: '1.3' },
  text: { fontSize: '15px', color: '#0B1F3A', lineHeight: '1.6', margin: '0 0 16px' },
  textSmall: { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '24px 0', wordBreak: 'break-all' as const },
  linkPlain: { color: '#0B1F3A', textDecoration: 'underline', fontSize: '12px' },
  button: { backgroundColor: '#0B1F3A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '16px', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' },
  footer: { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '32px 0 16px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' },
  signature: { fontSize: '13px', color: '#0B1F3A', margin: '16px 0 0' },
}

export const recoveryDiagnosticsScenarios = [
  {
    id: 'text-minimal',
    label: 'Text → Восстановление пароля',
    jsx: '<Text>Восстановление пароля</Text>',
    expected: recoveryDiagnosticStrings.minimal,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head>
          <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
          <meta charSet="utf-8" />
        </Head>
        <Body>
          <Text>{recoveryDiagnosticStrings.minimal}</Text>
        </Body>
      </Html>
    ),
  },
  {
    id: 'text-brand-plain',
    label: 'Text → Фонд Лига',
    jsx: '<Text>Фонд Лига</Text>',
    expected: recoveryDiagnosticStrings.brandPlain,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.brandPlain}</Text></Body></Html>,
  },
  {
    id: 'text-brand-quotes',
    label: 'Text → Фонд «Лига»',
    jsx: '<Text>Фонд «Лига»</Text>',
    expected: recoveryDiagnosticStrings.brandQuoted,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.brandQuoted}</Text></Body></Html>,
  },
  {
    id: 'text-brand-ascii-quotes',
    label: 'Text → Фонд "Лига"',
    jsx: '<Text>Фонд "Лига"</Text>',
    expected: recoveryDiagnosticStrings.brandAsciiQuoted,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.brandAsciiQuoted}</Text></Body></Html>,
  },
  {
    id: 'text-cabinet',
    label: 'Text → личный кабинет',
    jsx: '<Text>личный кабинет</Text>',
    expected: recoveryDiagnosticStrings.cabinet,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.cabinet}</Text></Body></Html>,
  },
  {
    id: 'text-cabinet-brand',
    label: 'Text → личный кабинет Фонд «Лига»',
    jsx: '<Text>личный кабинет {BRAND_NAME}</Text>',
    expected: `личный кабинет ${BRAND_NAME}`,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{'личный кабинет '}{BRAND_NAME}</Text></Body></Html>,
  },
  {
    id: 'text-long-hardcoded',
    label: 'Text → длинная строка целиком',
    jsx: '<Text>Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете Фонд «Лига».</Text>',
    expected: recoveryDiagnosticStrings.hardcodedSentence,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.hardcodedSentence}</Text></Body></Html>,
  },
  {
    id: 'text-long-interpolated',
    label: 'Text → длинная строка + {BRAND_NAME}',
    jsx: '<Text>{prefix}{BRAND_NAME}.</Text>',
    expected: `${recoveryDiagnosticStrings.sentencePrefix}${BRAND_NAME}.`,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text></Body></Html>,
  },
  {
    id: 'text-donor-cabinet',
    label: 'Text → личный кабинет жертвователя',
    jsx: '<Text>личный кабинет жертвователя</Text>',
    expected: recoveryDiagnosticStrings.donorCabinet,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Text>{recoveryDiagnosticStrings.donorCabinet}</Text></Body></Html>,
  },
  {
    id: 'heading-brand-quotes',
    label: 'Heading → Фонд «Лига»',
    jsx: '<Heading>Фонд «Лига»</Heading>',
    expected: recoveryDiagnosticStrings.brandQuoted,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Heading>{recoveryDiagnosticStrings.brandQuoted}</Heading></Body></Html>,
  },
  {
    id: 'container-text-interpolated',
    label: 'Container/Text → длинная строка + {BRAND_NAME}',
    jsx: '<Container><Text>{prefix}{BRAND_NAME}.</Text></Container>',
    expected: `${recoveryDiagnosticStrings.sentencePrefix}${BRAND_NAME}.`,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Container><Text>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text></Container></Body></Html>,
  },
  {
    id: 'section-text-interpolated',
    label: 'Section/Text → длинная строка + {BRAND_NAME}',
    jsx: '<Section><Text>{prefix}{BRAND_NAME}.</Text></Section>',
    expected: `${recoveryDiagnosticStrings.sentencePrefix}${BRAND_NAME}.`,
    node: () => <Html lang="ru" dir="ltr"><Head /><Body><Section><Text>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text></Section></Body></Html>,
  },
  {
    id: 'preview-interpolated',
    label: 'Preview → Восстановление пароля в личном кабинете {BRAND_NAME}',
    jsx: '<Preview>Восстановление пароля в личном кабинете {BRAND_NAME}</Preview>',
    expected: `Восстановление пароля в личном кабинете ${BRAND_NAME}`,
    node: () => <Html lang="ru" dir="ltr"><Head /><Preview>{`Восстановление пароля в личном кабинете ${BRAND_NAME}`}</Preview><Body><Text>ok</Text></Body></Html>,
  },
  {
    id: 'recovery-body-exact-structure',
    label: 'Recovery structure → Preview + Container + Section + Heading + Text',
    jsx: '<Html><Head/><Preview>...{BRAND_NAME}</Preview><Body><Container><Section><Text>{BRAND_NAME}</Text></Section><Heading>...</Heading><Text>...{BRAND_NAME}.</Text></Container></Body></Html>',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head>
          <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
          <meta charSet="utf-8" />
        </Head>
        <Preview>{`Восстановление пароля в личном кабинете ${BRAND_NAME}`}</Preview>
        <Body>
          <Container>
            <Section>
              <Text>{BRAND_NAME}</Text>
            </Section>
            <Heading>Восстановление пароля</Heading>
            <Text>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text>
          </Container>
        </Body>
      </Html>
    ),
  },
  {
    id: 'recovery-text-with-style-only',
    label: 'Recovery text only + real text style',
    jsx: '<Text style={text}>...{BRAND_NAME}.</Text>',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head />
        <Body>
          <Text style={recoveryStyles.text}>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text>
        </Body>
      </Html>
    ),
  },
  {
    id: 'recovery-main-container-text-styled',
    label: 'Recovery main/container + styled text',
    jsx: '<Body style={main}><Container style={container}><Text style={text}>...{BRAND_NAME}.</Text></Container></Body>',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head />
        <Body style={recoveryStyles.main}>
          <Container style={recoveryStyles.container}>
            <Text style={recoveryStyles.text}>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text>
          </Container>
        </Body>
      </Html>
    ),
  },
  {
    id: 'recovery-header-heading-text-styled',
    label: 'Recovery header + heading + styled text',
    jsx: '<Container><Section style={header}><Text style={brand}>{BRAND_NAME}</Text></Section><Heading style={h1}>...</Heading><Text style={text}>...{BRAND_NAME}.</Text></Container>',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head />
        <Body style={recoveryStyles.main}>
          <Container style={recoveryStyles.container}>
            <Section style={recoveryStyles.header}><Text style={recoveryStyles.brand}>{BRAND_NAME}</Text></Section>
            <Heading style={recoveryStyles.h1}>Восстановление пароля</Heading>
            <Text style={recoveryStyles.text}>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text>
          </Container>
        </Body>
      </Html>
    ),
  },
  {
    id: 'recovery-add-button-block',
    label: 'Recovery + button block',
    jsx: '<Container>header + heading + styled text + button section</Container>',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head />
        <Body style={recoveryStyles.main}>
          <Container style={recoveryStyles.container}>
            <Section style={recoveryStyles.header}><Text style={recoveryStyles.brand}>{BRAND_NAME}</Text></Section>
            <Heading style={recoveryStyles.h1}>Восстановление пароля</Heading>
            <Text style={recoveryStyles.text}>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text>
            <Text style={recoveryStyles.text}>Нажмите кнопку ниже, чтобы задать новый пароль:</Text>
            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <a href="https://example.com/reset" style={recoveryStyles.button}>Сбросить пароль</a>
            </Section>
          </Container>
        </Body>
      </Html>
    ),
  },
  {
    id: 'recovery-add-link-footer-signature',
    label: 'Recovery full structure without imported component',
    jsx: '<Container>full recovery content with real styles</Container>',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => (
      <Html lang="ru" dir="ltr">
        <Head>
          <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
          <meta charSet="utf-8" />
        </Head>
        <Preview>{`Восстановление пароля в личном кабинете ${BRAND_NAME}`}</Preview>
        <Body style={recoveryStyles.main}>
          <Container style={recoveryStyles.container}>
            <Section style={recoveryStyles.header}><Text style={recoveryStyles.brand}>{BRAND_NAME}</Text></Section>
            <Heading style={recoveryStyles.h1}>Восстановление пароля</Heading>
            <Text style={recoveryStyles.text}>{recoveryDiagnosticStrings.sentencePrefix}{BRAND_NAME}.</Text>
            <Text style={recoveryStyles.text}>Нажмите кнопку ниже, чтобы задать новый пароль:</Text>
            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <a href="https://example.com/reset" style={recoveryStyles.button}>Сбросить пароль</a>
            </Section>
            <Text style={recoveryStyles.textSmall}>Если кнопка не работает, скопируйте ссылку в браузер: https://example.com/reset</Text>
            <Text style={recoveryStyles.footer}>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо — пароль останется прежним.</Text>
            <Text style={recoveryStyles.signature}>С теплом, команда фонда «Лига»</Text>
          </Container>
        </Body>
      </Html>
    ),
  },
  {
    id: 'recovery-component-full',
    label: 'RecoveryEmail full component',
    jsx: '<RecoveryEmail siteName={BRAND_NAME} confirmationUrl="https://example.com/reset" />',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => <RecoveryEmail siteName={BRAND_NAME} confirmationUrl="https://example.com/reset" />,
  },
] as const
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
    id: 'recovery-component-full',
    label: 'RecoveryEmail full component',
    jsx: '<RecoveryEmail siteName={BRAND_NAME} confirmationUrl="https://example.com/reset" />',
    expected: `Мы получили запрос на сброс пароля для вашего аккаунта в личном кабинете ${BRAND_NAME}.`,
    node: () => <RecoveryEmail siteName={BRAND_NAME} confirmationUrl="https://example.com/reset" />,
  },
] as const
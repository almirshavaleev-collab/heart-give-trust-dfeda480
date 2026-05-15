import { BRAND_NAME, BRAND_SIGNATURE } from "../brand.ts";

export type AuthEmailType =
  | "signup"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change"
  | "reauthentication";

export interface AuthTemplateInput {
  email: string;
  newEmail?: string;
  confirmationUrl: string;
  token: string;
  siteUrl: string;
}

export interface RenderedAuthEmail {
  subject: string;
  html: string;
  text: string;
}

const LOGO_URL = "https://ligacommunity.ru/logo_h.svg";

function shell(opts: {
  preheader: string;
  heading: string;
  intro: string;
  buttonLabel?: string;
  buttonUrl?: string;
  body?: string;
  outro?: string;
}): string {
  const { preheader, heading, intro, buttonLabel, buttonUrl, body, outro } = opts;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#0B1F3A;">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E6EAF0;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <img src="${LOGO_URL}" alt="${BRAND_NAME}" height="32" style="height:32px;display:block;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 8px 40px;">
              <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;color:#0B1F3A;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 0 40px;font-size:16px;line-height:1.55;color:#0B1F3A;">
              ${intro}
            </td>
          </tr>
          ${
            buttonLabel && buttonUrl
              ? `<tr><td style="padding:24px 40px 8px 40px;">
                  <a href="${buttonUrl}" style="display:inline-block;background:#0B1F3A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:16px;">${buttonLabel}</a>
                </td></tr>
                <tr><td style="padding:8px 40px 0 40px;font-size:13px;line-height:1.5;color:#5B6B82;">
                  Если кнопка не работает, скопируйте ссылку в браузер:<br/>
                  <span style="word-break:break-all;color:#0B1F3A;">${buttonUrl}</span>
                </td></tr>`
              : ""
          }
          ${body ? `<tr><td style="padding:24px 40px 0 40px;font-size:16px;line-height:1.55;color:#0B1F3A;">${body}</td></tr>` : ""}
          ${
            outro
              ? `<tr><td style="padding:24px 40px 0 40px;font-size:14px;line-height:1.5;color:#5B6B82;">${outro}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:32px 40px 32px 40px;font-size:13px;line-height:1.5;color:#8A98AD;border-top:1px solid #F0F2F6;margin-top:24px;">
              С уважением,<br/>${BRAND_SIGNATURE}
            </td>
          </tr>
        </table>
        <div style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8A98AD;text-align:center;">
          Письмо отправлено автоматически, отвечать на него не нужно.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textBlock(lines: string[]): string {
  return lines.filter(Boolean).join("\n\n");
}

export function renderAuthEmail(
  type: AuthEmailType,
  data: AuthTemplateInput,
): RenderedAuthEmail {
  switch (type) {
    case "signup": {
      const subject = `Подтвердите регистрацию в ${BRAND_NAME}`;
      return {
        subject,
        html: shell({
          preheader: "Подтвердите ваш email, чтобы активировать аккаунт",
          heading: "Подтвердите регистрацию",
          intro:
            "Вы создали аккаунт жертвователя. Чтобы активировать его, подтвердите ваш email — это займёт несколько секунд.",
          buttonLabel: "Подтвердить email",
          buttonUrl: data.confirmationUrl,
          outro: "Если вы не регистрировались, просто проигнорируйте это письмо.",
        }),
        text: textBlock([
          "Подтвердите регистрацию",
          `Вы создали аккаунт жертвователя в ${BRAND_NAME}. Подтвердите email по ссылке:`,
          data.confirmationUrl,
          "Если вы не регистрировались, проигнорируйте это письмо.",
        ]),
      };
    }
    case "magiclink": {
      return {
        subject: `Ссылка для входа в ${BRAND_NAME}`,
        html: shell({
          preheader: "Одноразовая ссылка для входа в личный кабинет",
          heading: "Вход в личный кабинет",
          intro: "Нажмите на кнопку ниже, чтобы войти. Ссылка одноразовая и действует ограниченное время.",
          buttonLabel: "Войти",
          buttonUrl: data.confirmationUrl,
          outro: "Если вы не запрашивали вход, проигнорируйте это письмо.",
        }),
        text: textBlock([
          "Вход в личный кабинет",
          "Перейдите по ссылке для входа:",
          data.confirmationUrl,
          "Если вы не запрашивали вход, проигнорируйте письмо.",
        ]),
      };
    }
    case "recovery": {
      return {
        subject: `Восстановление пароля — ${BRAND_NAME}`,
        html: shell({
          preheader: "Установите новый пароль за пару минут",
          heading: "Восстановление пароля",
          intro:
            "Мы получили запрос на смену пароля для вашего аккаунта. Чтобы установить новый пароль, нажмите на кнопку ниже.",
          buttonLabel: "Сбросить пароль",
          buttonUrl: data.confirmationUrl,
          outro: "Если вы не запрашивали сброс пароля, ничего делать не нужно — пароль останется прежним.",
        }),
        text: textBlock([
          "Восстановление пароля",
          "Перейдите по ссылке, чтобы задать новый пароль:",
          data.confirmationUrl,
          "Если вы не запрашивали сброс, проигнорируйте письмо.",
        ]),
      };
    }
    case "invite": {
      return {
        subject: `Приглашение в ${BRAND_NAME}`,
        html: shell({
          preheader: "Вас пригласили в личный кабинет фонда",
          heading: "Приглашение в личный кабинет",
          intro: "Вас пригласили присоединиться к личному кабинету фонда. Примите приглашение, чтобы продолжить.",
          buttonLabel: "Принять приглашение",
          buttonUrl: data.confirmationUrl,
        }),
        text: textBlock([
          "Приглашение в личный кабинет",
          "Примите приглашение по ссылке:",
          data.confirmationUrl,
        ]),
      };
    }
    case "email_change": {
      const target = data.newEmail || data.email;
      return {
        subject: `Подтверждение смены email — ${BRAND_NAME}`,
        html: shell({
          preheader: "Подтвердите новый адрес электронной почты",
          heading: "Подтверждение смены email",
          intro: `Вы запросили смену адреса электронной почты на <b>${target}</b>. Подтвердите новый адрес, чтобы изменения вступили в силу.`,
          buttonLabel: "Подтвердить новый email",
          buttonUrl: data.confirmationUrl,
          outro: "Если вы не запрашивали смену email, срочно смените пароль и свяжитесь с нами.",
        }),
        text: textBlock([
          "Подтверждение смены email",
          `Подтвердите новый адрес ${target} по ссылке:`,
          data.confirmationUrl,
        ]),
      };
    }
    case "reauthentication": {
      return {
        subject: `Код подтверждения — ${BRAND_NAME}`,
        html: shell({
          preheader: "Одноразовый код для подтверждения действия",
          heading: "Код подтверждения",
          intro:
            "Для подтверждения действия в личном кабинете введите одноразовый код. Никому не сообщайте его.",
          body: `<div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0B1F3A;background:#F5F7FB;border-radius:16px;padding:20px 24px;text-align:center;">${data.token}</div>`,
          outro: "Код действует ограниченное время. Если вы не запрашивали его, проигнорируйте это письмо.",
        }),
        text: textBlock([
          "Код подтверждения",
          `Ваш код: ${data.token}`,
          "Если вы не запрашивали код, проигнорируйте письмо.",
        ]),
      };
    }
  }
}
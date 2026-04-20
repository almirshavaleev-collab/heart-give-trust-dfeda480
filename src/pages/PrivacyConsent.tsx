import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const DOMAIN = "ligafund.ru";

const PrivacyConsent = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto px-4">
            <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
                На главную
              </Link>
            </Button>

            <article className="space-y-5 text-sm leading-7 text-foreground">
              <header className="pb-4 border-b border-border">
                <h1 className="text-2xl font-bold mb-2 text-foreground">
                  Согласие на обработку персональных данных
                </h1>
              </header>

              <p>
                Пользователь, оставляя заявку, осуществляя пожертвование, оформляя подписку,
                направляя запрос на обратную связь, регистрируясь либо совершая иные действия,
                связанные с внесением своих персональных данных на интернет-сайте{" "}
                <a
                  href={`https://${DOMAIN}`}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {DOMAIN}
                </a>
                , принимает настоящее Согласие на обработку персональных данных (далее — Согласие).
              </p>

              <p>
                Принятием Согласия является подтверждение факта согласия Пользователя со всеми
                пунктами настоящего Согласия. Пользователь дает свое согласие ФОНДУ «ВЫПУСКНИКИ
                ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА», которому принадлежит сайт{" "}
                <a
                  href={`https://${DOMAIN}`}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {DOMAIN}
                </a>
                , на обработку своих персональных данных на следующих условиях:
              </p>

              <p>
                Пользователь дает согласие на обработку своих персональных данных как без
                использования средств автоматизации, так и с их использованием.
              </p>

              <section className="space-y-3">
                <p>
                  Согласие дается на обработку следующих персональных данных, не являющихся
                  специальными или биометрическими:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>фамилия, имя, отчество;</li>
                  <li>адрес электронной почты;</li>
                  <li>номер телефона;</li>
                  <li>сведения о платежах и пожертвованиях;</li>
                  <li>иные данные, добровольно предоставляемые Пользователем.</li>
                </ul>
              </section>

              <p>Персональные данные Пользователя не являются общедоступными.</p>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  1. Целью обработки персональных данных является:
                </h2>
                <ul className="list-disc pl-6 space-y-1">
                  <li>обеспечение работы функционала сайта;</li>
                  <li>прием и учет пожертвований;</li>
                  <li>обратная связь с Пользователем;</li>
                  <li>направление информационных сообщений о деятельности Фонда;</li>
                  <li>ведение внутренней отчетности Фонда;</li>
                  <li>исполнение требований законодательства Российской Федерации.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  2. Основанием для сбора, обработки и хранения персональных данных являются:
                </h2>
                <ul className="list-disc pl-6 space-y-1">
                  <li>ст. 23, 24 Конституции Российской Федерации;</li>
                  <li>
                    ст. 2, 5, 6, 7, 9, 18–22 Федерального закона от 27.07.2006 №152-ФЗ
                    «О персональных данных»;
                  </li>
                  <li>иные применимые нормы законодательства Российской Федерации;</li>
                  <li>Устав ФОНДА «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА»;</li>
                  <li>Политика обработки персональных данных;</li>
                  <li>настоящее Согласие.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  3. В ходе обработки персональных данных могут совершаться следующие действия:
                </h2>
                <ul className="list-disc pl-6 space-y-1">
                  <li>сбор;</li>
                  <li>запись;</li>
                  <li>систематизация;</li>
                  <li>накопление;</li>
                  <li>хранение;</li>
                  <li>уточнение (обновление, изменение);</li>
                  <li>извлечение;</li>
                  <li>использование;</li>
                  <li>
                    передача (предоставление, доступ) в случаях, предусмотренных законодательством
                    Российской Федерации и необходимых для обработки платежей;
                  </li>
                  <li>обезличивание;</li>
                  <li>блокирование;</li>
                  <li>удаление;</li>
                  <li>уничтожение.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  4. Передача персональных данных третьим лицам
                </h2>
                <p>
                  Передача персональных данных третьим лицам осуществляется только в случаях,
                  необходимых для исполнения целей обработки, в том числе операторам платежных
                  сервисов, банкам и иным организациям, участвующим в проведении пожертвований,
                  либо в случаях, прямо предусмотренных законодательством Российской Федерации.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  5. Достоверность данных
                </h2>
                <p>
                  Пользователь подтверждает, что указанные им персональные данные принадлежат
                  лично ему и предоставляются достоверно.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  6. Срок хранения и обработки
                </h2>
                <p>
                  Персональные данные хранятся и обрабатываются до достижения целей обработки
                  либо до отзыва согласия Пользователем, если иное не предусмотрено
                  законодательством Российской Федерации.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  7. Информационные сообщения
                </h2>
                <p>
                  Пользователь согласен на получение информационных сообщений, связанных с
                  деятельностью Фонда, если он отдельно выразил такое согласие либо если такие
                  сообщения необходимы для исполнения действий Пользователя на сайте.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  8. Отзыв согласия
                </h2>
                <p>
                  Согласие может быть отозвано Пользователем либо его законным представителем
                  путем направления письменного уведомления на электронную почту:{" "}
                  <a href="mailto:456004a@mail.ru" className="text-primary hover:underline">
                    456004a@mail.ru
                  </a>{" "}
                  с пометкой «Отзыв согласия на обработку персональных данных».
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  9. Обработка данных после отзыва согласия
                </h2>
                <p>
                  В случае отзыва согласия Фонд вправе продолжить обработку персональных данных
                  без согласия Пользователя при наличии оснований, предусмотренных
                  законодательством Российской Федерации, в частности Федеральным законом
                  №152-ФЗ «О персональных данных».
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  10. Срок действия Согласия
                </h2>
                <p>
                  Настоящее Согласие действует бессрочно до момента прекращения обработки
                  персональных данных по основаниям, предусмотренным законодательством
                  Российской Федерации или настоящим Согласием.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">
                  11. Сведения об операторе персональных данных
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 pt-2">
                  <dt className="font-medium text-muted-foreground">Полное наименование:</dt>
                  <dd className="sm:col-span-2">
                    ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА»
                  </dd>

                  <dt className="font-medium text-muted-foreground">ИНН:</dt>
                  <dd className="sm:col-span-2">1644076378</dd>

                  <dt className="font-medium text-muted-foreground">КПП:</dt>
                  <dd className="sm:col-span-2">164401001</dd>

                  <dt className="font-medium text-muted-foreground">ОГРН:</dt>
                  <dd className="sm:col-span-2">1161690050741</dd>

                  <dt className="font-medium text-muted-foreground">Юридический адрес:</dt>
                  <dd className="sm:col-span-2">
                    423440, Республика Татарстан, Альметьевский район, пгт Нижняя Мактама,
                    ул. Заводская, дом 12, кв. 37
                  </dd>

                  <dt className="font-medium text-muted-foreground">Фактический адрес:</dt>
                  <dd className="sm:col-span-2">
                    423450, Республика Татарстан, г. Альметьевск, ул. Тельмана, дом 55а
                  </dd>

                  <dt className="font-medium text-muted-foreground">Телефон:</dt>
                  <dd className="sm:col-span-2">
                    <a href="tel:+78553440604" className="text-primary hover:underline">
                      +7 (8553) 440-604
                    </a>
                  </dd>

                  <dt className="font-medium text-muted-foreground">Email:</dt>
                  <dd className="sm:col-span-2">
                    <a href="mailto:456004a@mail.ru" className="text-primary hover:underline">
                      456004a@mail.ru
                    </a>
                  </dd>
                </dl>
              </section>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyConsent;

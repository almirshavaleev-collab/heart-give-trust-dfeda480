import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Offer = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
                На главную
              </Link>
            </Button>

            <article className="space-y-6 text-sm leading-relaxed text-foreground">
              <header className="space-y-2 pb-4 border-b border-border">
                <h1 className="text-2xl font-bold text-foreground">
                  Публичная оферта
                </h1>
                <p className="text-muted-foreground">
                  о заключении договора пожертвования
                </p>
              </header>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">1. Общие положения</h2>
                <p>
                  1.1. Настоящая публичная оферта (далее — «Оферта») является предложением
                  ФОНДА «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА» (далее — «Фонд»)
                  заключить с любым физическим или юридическим лицом (далее — «Благотворитель»)
                  договор пожертвования (далее — «Договор») на условиях, изложенных ниже.
                </p>
                <p>
                  1.2. Оферта является публичной офертой в соответствии со ст. 437 Гражданского
                  кодекса Российской Федерации.
                </p>
                <p>
                  1.3. Оферта вступает в силу с момента размещения на сайте Фонда по адресу:{" "}
                  <a href="https://ligafund.ru" className="text-foreground underline hover:no-underline">
                    ligafund.ru
                  </a>
                </p>
                <p>
                  1.4. Оферта действует бессрочно. Фонд вправе изменить или отменить Оферту в
                  любое время без объяснения причин.
                </p>
                <p>1.5. Изменения вступают в силу с момента их публикации на сайте.</p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">2. Предмет договора</h2>
                <p>
                  2.1. Благотворитель добровольно передает денежные средства Фонду в качестве
                  пожертвования.
                </p>
                <p>
                  2.2. Фонд принимает пожертвование и обязуется использовать его в рамках своей
                  уставной деятельности.
                </p>
                <p>
                  2.3. Пожертвование осуществляется в соответствии со ст. 582 Гражданского
                  кодекса Российской Федерации.
                </p>
                <p>2.4. Размер пожертвования определяется Благотворителем самостоятельно.</p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">3. Порядок заключения договора</h2>
                <p>3.1. Договор считается заключенным с момента акцепта Оферты Благотворителем.</p>
                <p>3.2. Акцептом Оферты считается:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>оплата через сайт Фонда (банковской картой, СБП, через сервис ЮKassa и иные способы)</li>
                  <li>перевод по банковским реквизитам Фонда</li>
                  <li>иные способы перечисления средств</li>
                </ul>
                <p>
                  3.3. Датой заключения Договора считается дата поступления денежных средств на
                  расчетный счет Фонда.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">4. Порядок использования пожертвований</h2>
                <p>4.1. Все полученные средства используются строго в рамках уставной деятельности Фонда.</p>
                <p>
                  4.2. В случае достижения цели конкретного сбора либо утраты актуальности, Фонд
                  вправе направить пожертвование на иные уставные цели и проекты.
                </p>
                <p>4.3. Фонд вправе публиковать отчеты о своей деятельности на сайте.</p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">5. Персональные данные</h2>
                <p>
                  5.1. Благотворитель дает согласие на обработку своих персональных данных в
                  соответствии с Федеральным законом №152-ФЗ «О персональных данных».
                </p>
                <p>5.2. Персональные данные используются исключительно для:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>обработки пожертвований</li>
                  <li>ведения отчетности</li>
                  <li>связи с Благотворителем</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">6. Прочие условия</h2>
                <p>6.1. Благотворитель подтверждает, что действует добровольно и осознанно.</p>
                <p>
                  6.2. Фонд не несет иных обязательств перед Благотворителем, кроме указанных в
                  настоящей Оферте.
                </p>
                <p>6.3. Все споры решаются в соответствии с законодательством Российской Федерации.</p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold mt-6 text-foreground">7. Реквизиты Фонда</h2>

                <dl className="space-y-3">
                  <div>
                    <dt className="text-muted-foreground">Полное наименование:</dt>
                    <dd className="font-medium">ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА»</dd>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <dt className="text-muted-foreground">ИНН:</dt>
                      <dd className="font-medium">1644076378</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">КПП:</dt>
                      <dd className="font-medium">164401001</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">ОГРН:</dt>
                      <dd className="font-medium">1161690050741</dd>
                    </div>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Расчетный счет:</dt>
                    <dd className="font-medium">40703810462000000880</dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Корреспондентский счет:</dt>
                    <dd className="font-medium">30101810600000000603</dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">БИК:</dt>
                    <dd className="font-medium">049205603</dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Банк:</dt>
                    <dd className="font-medium">Отделение «Банк Татарстан» №8610 ПАО СБЕРБАНК г. Казань</dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Юридический адрес:</dt>
                    <dd className="font-medium">
                      423440, Республика Татарстан, Альметьевский район,<br />
                      пгт Нижняя Мактама, ул. Заводская, дом 12, кв. 37
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Фактический адрес:</dt>
                    <dd className="font-medium">
                      423450, Республика Татарстан, г. Альметьевск,<br />
                      ул. Тельмана, дом 55а
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Телефон:</dt>
                    <dd className="font-medium">
                      <a href="tel:+78553440604" className="hover:underline">+7 (8553) 440-604</a>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">Email:</dt>
                    <dd className="font-medium">
                      <a href="mailto:456004a@mail.ru" className="hover:underline">456004a@mail.ru</a>
                    </dd>
                  </div>
                </dl>
              </section>
            </article>

            <div className="mt-10 pt-6 border-t border-border">
              <Button asChild variant="outline" size="sm">
                <Link to="/">
                  <ArrowLeft className="w-4 h-4" />
                  Вернуться на главную
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Offer;

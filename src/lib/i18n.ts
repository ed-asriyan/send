import { dictionary, locale, _ } from 'svelte-i18n';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import fr from '../locales/fr.json';

function setupI18n() {
  dictionary.set({
    en,
    ru,
    fr,
  });

  let initialLocale = 'en';

  if (typeof window !== 'undefined') {
    const savedLocale = localStorage.getItem('app_locale');
    if (savedLocale) {
      initialLocale = savedLocale;
    } else {
      const browserLocale = navigator.language.split('-')[0];
      initialLocale = ['en', 'ru', 'fr'].includes(browserLocale) ? browserLocale : 'en';
    }

    locale.subscribe((newLocale) => {
      if (newLocale) {
        localStorage.setItem('app_locale', newLocale);
      }
    });

    locale.set(initialLocale);
  } else {
    locale.set(initialLocale);
  }
}

setupI18n();

export { locale, _ };
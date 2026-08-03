declare module 'i18n-iso-countries' {
  export function registerLocale(locale: unknown): void;
  export function getName(code: string, lang: string): string | undefined;
}

declare module 'i18n-iso-countries/langs/*.json' {
  const locale: unknown;
  export default locale;
}

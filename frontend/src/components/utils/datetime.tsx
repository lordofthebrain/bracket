import { format, Locale, parseISO } from 'date-fns';
import { de, el, enUS, es, faIR, fr, it, ja, nl, pt, sv, zhCN } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const dateFnsLocales: Record<string, Locale> = {
  de,
  el,
  en: enUS,
  es,
  fa: faIR,
  fr,
  it,
  ja,
  nl,
  pt,
  sv,
  zh: zhCN,
};

function useDateFnsLocale() {
  const { i18n } = useTranslation();
  return dateFnsLocales[i18n.language.split('-')[0]] || enUS;
}

export function DateTime({ datetime }: { datetime: string }) {
  const date = parseISO(datetime);
  const locale = useDateFnsLocale();
  return <time dateTime={datetime}>{format(date, 'd LLLL yyyy HH:mm', { locale })}</time>;
}

export function Time({ datetime }: { datetime: string }) {
  const date = parseISO(datetime);
  const locale = useDateFnsLocale();
  return <time dateTime={datetime}>{format(date, 'HH:mm', { locale })}</time>;
}

export function formatTime(datetime: string) {
  return format(parseISO(datetime), 'HH:mm');
}

export function compareDateTime(datetime1: string, datetime2: string) {
  return parseISO(datetime1) > parseISO(datetime2);
}

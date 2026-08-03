import { Select } from '@mantine/core';
import countries from 'i18n-iso-countries';
import deLocale from 'i18n-iso-countries/langs/de.json';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { useTranslation } from 'react-i18next';

countries.registerLocale(enLocale);
countries.registerLocale(deLocale);

const EUROPEAN_COUNTRY_CODES = [
  'AL', 'AD', 'AM', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ',
  'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT',
  'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK',
  'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES',
  'SE', 'CH', 'TR', 'UA', 'GB', 'VA',
];

const EXTRA_ENTRIES: { [code: string]: { en: string; de: string } } = {
  'GB-ENG': { en: 'England', de: 'England' },
  'GB-SCT': { en: 'Scotland', de: 'Schottland' },
  'GB-WLS': { en: 'Wales', de: 'Wales' },
  'GB-NIR': { en: 'Northern Ireland', de: 'Nordirland' },
};

const NAME_OVERRIDES: { [code: string]: { en?: string; de?: string } } = {
  RU: { de: 'Russland' },
  CZ: { de: 'Tschechien' },
};

export function getCountryDisplayName(code: string, locale: 'en' | 'de'): string {
  return (
    NAME_OVERRIDES[code]?.[locale] ??
    EXTRA_ENTRIES[code]?.[locale] ??
    countries.getName(code, locale) ??
    countries.getName(code, 'en') ??
    code
  );
}

export function CountrySelect({ form }: { form: any }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('de') ? 'de' : 'en';

  const data = [...EUROPEAN_COUNTRY_CODES, ...Object.keys(EXTRA_ENTRIES)]
    .map((code) => ({ value: code, label: getCountryDisplayName(code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Select
      data={data}
      label={t('team_country_input_label')}
      placeholder={t('team_country_input_placeholder')}
      searchable
      clearable
      limit={20}
      mt={12}
      {...form.getInputProps('country')}
    />
  );
}

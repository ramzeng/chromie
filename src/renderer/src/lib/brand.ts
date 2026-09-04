import packageMetadata from '../../../../package.json'

export const CHROMIE_LOGO_URL = new URL(
  '../../../../resources/chromie-logo-knot.svg',
  import.meta.url
).href

export const CHROMIE_APP_ICON_URL = new URL(
  '../../../../resources/chromie-app-icon-knot.svg',
  import.meta.url
).href

export const CHROMIE_VERSION = packageMetadata.version

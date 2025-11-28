export default defineNuxtPlugin((nuxtApp) => {
  const isDev = process.env.NODE_ENV !== 'production'
  
  const { locales } = useI18n()

  nuxtApp.hook('i18n:beforeLocaleSwitch', (options) => {
    const { oldLocale, newLocale, initialSetup } = options

    if (isDev) {
      console.log('[i18n] Before locale switch:', {
        oldLocale,
        newLocale,
        initialSetup,
      })
    }

    const localeExists = locales.value.some(loc => 
      (typeof loc === 'string' ? loc : loc.code) === newLocale
    )

    if (!localeExists && !initialSetup) {
      if (isDev) {
        console.warn(`[i18n] Locale "${newLocale}" not found, keeping "${oldLocale}"`)
      }
      options.newLocale = oldLocale
    }
  })

  nuxtApp.hook('i18n:localeSwitched', (options) => {
    const { oldLocale, newLocale } = options

    if (isDev) {
      console.log('[i18n] Locale switched:', {
        oldLocale,
        newLocale,
      })
    }
  })
})

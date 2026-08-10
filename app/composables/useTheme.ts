/**
 * Theme toggle backed by a cookie rather than localStorage.
 *
 * localStorage is not readable during SSR, so the server would always render one
 * theme and the client would repaint on hydration — the classic dark-mode flash.
 * A cookie is sent with the document request, so `useHead` can put the right
 * class on <html> in the very first byte of HTML.
 */
export type ThemeName = 'dark' | 'light'

export function useTheme() {
  const cookie = useCookie<ThemeName>('ecgo-theme', {
    default: () => 'dark', // ops runs this in a dim control room; dark is the norm
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const theme = computed<ThemeName>(() => (cookie.value === 'light' ? 'light' : 'dark'))

  useHead({
    htmlAttrs: {
      class: computed(() => (theme.value === 'dark' ? 'dark' : '')),
    },
  })

  function toggle() {
    cookie.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggle }
}

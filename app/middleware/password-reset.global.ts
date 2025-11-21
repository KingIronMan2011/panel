import { storeToRefs } from 'pinia'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server)
    return

  const authStore = useAuthStore()
  const { status, requiresPasswordReset } = storeToRefs(authStore)

  if (status.value === 'loading') {
    try {
      await authStore.syncSession({ force: true })
    }
    catch {
      return
    }
  }

  if (status.value !== 'authenticated')
    return

  if (!requiresPasswordReset.value)
    return

  if (to.path.startsWith('/auth/password/force'))
    return

  if (to.path === '/auth/logout')
    return

  return navigateTo({
    path: '/auth/password/force',
    query: {
      redirect: to.fullPath,
    },
  })
})

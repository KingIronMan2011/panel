<script setup lang="ts">
import { clearError, useRequestURL } from '#app'
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const requestURL = useRequestURL()

const headline = computed(() => {
  if (props.error.statusCode === 404) return 'Page not found'
  return 'Unexpected panel error'
})

const description = computed(() => {
  if (props.error.statusCode === 404) {
    const url = requestURL.href
    if (url.includes('/api/')) {
      return 'The requested API endpoint was not found. Check the endpoint URL and ensure the server is properly configured.'
    }
    if (url.includes('/server/')) {
      return 'The requested server page was not found. The server may not exist or you may not have permission to access it.'
    }
    return 'The requested page was not found.'
  }
  if (props.error.statusCode === 401) {
    return 'Authentication is required. Please sign in to access this resource.'
  }
  if (props.error.statusCode === 500) {
    return 'An internal server error occurred. Check server logs for more details.'
  }
  return props.error.statusMessage || 'No additional error context was provided.'
})

const requestedUrl = computed(() => {
  const dataUrl = (props.error.data as { url?: string } | undefined)?.url
  return dataUrl ?? requestURL.href
})

interface QuickLink {
  label: string
  icon: string
  to?: string
  action?: () => void
}

const quickLinks: QuickLink[] = [
  {
    label: 'Go back',
    icon: 'i-lucide-arrow-left',
    action: () => {
      if (import.meta.client && window.history.length > 1) {
        window.history.back()
      } else {
        clearError({ redirect: '/' })
      }
    },
  },
  { label: 'Admin dashboard', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Home', icon: 'i-lucide-home', to: '/' },
]

const handleReset = () => clearError({ redirect: '/' })
</script>

<template>
  <UPage>
    <UContainer class="min-h-screen flex items-center justify-center py-12">
      <section class="mx-auto max-w-xl text-center">
        <UCard :ui="{ body: 'space-y-4' }">
          <div class="flex flex-col items-center gap-2">
            <h1 class="text-2xl font-semibold">{{ headline }}</h1>
            <p class="text-sm text-muted-foreground">{{ description }}</p>
          </div>
          <div class="rounded-md border border-default bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Requested resource: <code>{{ requestedUrl }}</code>
          </div>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton v-for="link in quickLinks" :key="link.label" :icon="link.icon" :to="link.to" color="primary"
              variant="subtle" @click="link.action ? link.action() : undefined">
              {{ link.label }}
            </UButton>
            <UButton icon="i-lucide-refresh-ccw" variant="ghost" color="neutral" @click="handleReset">
              Try again
            </UButton>
          </div>
        </UCard>
      </section>
    </UContainer>
  </UPage>
</template>

<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { passwordRequestSchema } from '#shared/schema/account'
import type { PasswordRequestBody } from '#shared/types/account'

definePageMeta({
  layout: 'auth',
  auth: false,
})

const toast = useToast()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()

const turnstileSiteKey = computed(() => runtimeConfig.public.turnstile?.siteKey || '')
const hasTurnstile = computed(() => !!turnstileSiteKey.value && turnstileSiteKey.value.length > 0)
const turnstileToken = ref<string | undefined>(undefined)
const turnstileRef = ref<{ reset: () => void } | null>(null)

const fields: AuthFormField[] = [
  {
    name: 'identity',
    type: 'text',
    label: 'Username or Email',
    placeholder: 'Enter your username or email',
    icon: 'i-lucide-mail',
    required: true,
    autocomplete: 'username',
  },
]

const schema = passwordRequestSchema

const loading = ref(false)

const submitProps = computed(() => ({
  label: 'Send reset link',
  icon: 'i-lucide-send',
  block: true,
  variant: 'subtle' as const,
  color: 'primary' as const,
  loading: loading.value,
}))

async function onSubmit(payload: FormSubmitEvent<PasswordRequestBody>) {
  loading.value = true
  try {
    if (hasTurnstile.value && !turnstileToken.value) {
      toast.add({
        color: 'error',
        title: 'Verification required',
        description: 'Please complete the security verification.',
      })
      return
    }

    const identity = String(payload.data.identity).trim()
    const body: PasswordRequestBody = { identity }
    
    const fetchOptions: { headers?: Record<string, string> } = {}
    if (hasTurnstile.value && turnstileToken.value) {
      fetchOptions.headers = { 'x-captcha-response': turnstileToken.value }
    }

    const response = await fetch('/api/auth/password/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || 'Request failed')
    }
    
    await response.json() as { success: boolean }

    toast.add({
      title: 'Check your inbox',
      description: 'If the account exists, a reset email has been sent.',
      color: 'success',
    })

    router.push('/auth/login')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process request.'
    toast.add({
      title: 'Request failed',
      description: message,
      color: 'error',
    })
    turnstileRef.value?.reset()
    turnstileToken.value = undefined
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UAuthForm
    :schema="schema"
    :fields="fields"
    title="Reset your password"
    description="Enter the email address or username associated with your account."
    icon="i-lucide-key-round"
    :submit="submitProps"
    @submit="onSubmit as any"
  >
    <template #footer>
      <div class="space-y-4">
        <div v-if="hasTurnstile" class="flex flex-col items-center gap-2">
          <NuxtTurnstile
            ref="turnstileRef"
            :model-value="turnstileToken"
            :options="{
              theme: 'dark',
              size: 'normal',
            }"
            @update:model-value="(value: string | undefined) => { turnstileToken = value }"
          />
        </div>
        <NuxtLink to="/auth/login" class="text-primary font-medium block text-center">
          Back to sign in
        </NuxtLink>
      </div>
    </template>
  </UAuthForm>
</template>

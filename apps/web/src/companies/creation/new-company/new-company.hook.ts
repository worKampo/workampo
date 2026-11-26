import { zodResolver } from '@hookform/resolvers/zod'
import { useMe } from '@workampo/app-core/access/me'
import { ApiError } from '@workampo/app-core/api-error'
import { useCheckSlug } from '@workampo/app-core/companies/creation/check-slug'
import { useCreateCompany } from '@workampo/app-core/companies/creation/create-company'
import { createCompanyFormSchema } from '@workampo/app-core/companies/creation/create-company/form'
import { errorKey, errorKeyOf } from '@workampo/app-core/errors'
import { proposeSlug, type SlugProblem, slugProblem } from '@workampo/domain/_shared/slug'
import { LANGUAGES } from '@workampo/i18n'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

const CHECK_DELAY_MS = 300

type SlugStatus = 'checking' | 'available' | 'taken' | SlugProblem | undefined

// In the order the form shows them, so a failed submit focuses the first one in error.
const FIELDS = ['name', 'slug', 'defaultLanguage', 'userName'] as const

// The creation page: proposes the slug, checks it as it settles and creates the company with
// one idempotency key, so a retry after a lost answer never creates a second one.
export function useNewCompanyPage({
  onCreated,
  language,
}: {
  onCreated: (url: string) => void
  language?: string | undefined
}) {
  const me = useMe()
  const create = useCreateCompany()
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const form = useForm({
    resolver: zodResolver(createCompanyFormSchema),
    shouldFocusError: false,
    defaultValues: {
      name: '',
      slug: '',
      defaultLanguage: LANGUAGES.find((known) => known === language) ?? LANGUAGES[0],
      userName: undefined,
    },
  })
  const [name, slug] = useWatch({ control: form.control, name: ['name', 'slug'] })
  const settledSlug = useSettled(slug)
  const check = useCheckSlug({ slug: settledSlug, enabled: slugProblem(settledSlug) === null })
  const askUserName = me.data?.name === null
  const status = slugStatus()
  const banner = useRef<HTMLDivElement>(null)
  const sending = useRef(false)
  const submitFailed = create.isError && !isSlugTaken(create.error)

  // A field with no DOM input stays undefined, which the optional schema would accept.
  useEffect(() => {
    if (askUserName && form.getValues('userName') === undefined) form.setValue('userName', '')
  }, [form, askUserName])

  useEffect(() => {
    if (submitFailed) banner.current?.focus()
  }, [submitFailed])

  // Once the person edits the slug it is theirs: the name no longer proposes one.
  useEffect(() => {
    if (!form.getFieldState('slug').isDirty) form.setValue('slug', proposeSlug(name))
  }, [form, name])

  const submit = form.handleSubmit(
    ({ userName, ...company }) => {
      // The busy button is only aria-disabled, so a second click still lands here.
      if (sending.current) return
      // The schema already refused an invalid or reserved slug; one still being checked goes on,
      // and the API answers slug_taken if it is. After a server failure the half-created company
      // holds the slug, so the check says taken; the retry with the same key is what completes it.
      if (status === 'taken' && !failedOnServer()) {
        form.setFocus('slug')
        return
      }

      sending.current = true
      create.mutate(
        { input: askUserName && userName ? { ...company, userName } : company, idempotencyKey },
        {
          onSuccess: ({ url }) => {
            setIdempotencyKey(crypto.randomUUID())
            onCreated(url)
          },
          onError: (error) => {
            if (isSlugTaken(error)) form.setFocus('slug')
          },
          onSettled: () => {
            sending.current = false
          },
        },
      )
    },
    (errors) => {
      const first = FIELDS.find((field) => errors[field])
      if (first) form.setFocus(first)
    },
  )

  return {
    form,
    submit,
    isPending: create.isPending,
    banner,
    slugStatus: status,
    askUserName,
    fieldErrorKeys: fieldErrorKeys(),
    messageKey: messageKey(),
  }

  function fieldErrorKeys() {
    const { errors } = form.formState

    return {
      name: errors.name && ('companies:new_company.name_required' as const),
      // A slug that is there but wrong shows as the slug status, after the check's pause.
      slug: errors.slug && !slug ? ('companies:new_company.url_required' as const) : undefined,
      defaultLanguage: errors.defaultLanguage && errorKey('companies.invalid_request'),
      userName: errors.userName && errorKey('companies.user_name_required'),
    }
  }

  function slugStatus(): SlugStatus {
    if (isSlugTaken(create.error) && create.variables?.input.slug === slug) return 'taken'
    if (!slug) return undefined
    if (settledSlug !== slug) return 'checking'

    const problem = slugProblem(slug)
    if (problem) return problem
    if (check.data) return check.data.available ? 'available' : 'taken'

    return check.isError ? undefined : 'checking'
  }

  function failedOnServer() {
    return isServerFailure(create.error) && create.variables?.idempotencyKey === idempotencyKey
  }

  // Server answers only; the form's own errors show at their field.
  function messageKey() {
    if (create.error && !isSlugTaken(create.error)) return errorKeyOf(create.error)
    // The first failure, not the last retry: a slug check that waits seconds to fail says nothing.
    if (check.failureReason) return errorKeyOf(check.failureReason)

    return undefined
  }
}

function isSlugTaken(error: unknown) {
  return error instanceof ApiError && error.code === 'companies.slug_taken'
}

function isServerFailure(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

// The value once it has not changed for CHECK_DELAY_MS, so typing sends one check, not one per key.
function useSettled(value: string) {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [value])

  return settled
}

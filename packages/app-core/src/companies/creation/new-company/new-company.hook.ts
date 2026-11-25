import { zodResolver } from '@hookform/resolvers/zod'
import { proposeSlug, type SlugProblem, slugProblem } from '@workampo/domain/_shared/slug'
import { LANGUAGES } from '@workampo/i18n'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ApiError } from '../../../_shared/api-error'
import { errorKey, errorKeyOf } from '../../../_shared/error-key'
import { useMe } from '../../../access/me.hook'
import { useCheckSlug } from '../check-slug/check-slug.hook'
import { createCompanyFormSchema } from '../create-company/create-company.form'
import { useCreateCompany } from '../create-company/create-company.hook'

const CHECK_DELAY_MS = 300

type SlugStatus = 'checking' | 'available' | 'taken' | SlugProblem | undefined

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

  // Once the person edits the slug it is theirs: the name no longer proposes one.
  useEffect(() => {
    if (!form.getFieldState('slug').isDirty) form.setValue('slug', proposeSlug(name))
  }, [form, name])

  const submit = form.handleSubmit(({ userName, ...company }) => {
    // The schema already refused an invalid or reserved slug; one still being checked goes on,
    // and the API answers slug_taken if it is.
    if (status === 'taken') {
      form.setFocus('slug')
      return
    }

    create.mutate(
      { input: askUserName && userName ? { ...company, userName } : company, idempotencyKey },
      {
        onSuccess: ({ url }) => {
          setIdempotencyKey(crypto.randomUUID())
          onCreated(url)
        },
      },
    )
  })

  return {
    form,
    submit,
    isPending: create.isPending,
    slugStatus: status,
    askUserName,
    fieldErrorKeys: fieldErrorKeys(),
    messageKey: messageKey(),
  }

  function fieldErrorKeys() {
    const { errors } = form.formState

    return {
      name: errors.name && ('companies:new_company.name_required' as const),
      defaultLanguage: errors.defaultLanguage && errorKey('companies.invalid_request'),
      userName: errors.userName && errorKey('companies.user_name_required'),
    }
  }

  function slugStatus(): SlugStatus {
    if (isSlugTaken(create.error) && create.variables?.input.slug === slug) return 'taken'
    if (!slug) return undefined

    const problem = slugProblem(slug)
    if (problem) return problem
    if (settledSlug !== slug) return 'checking'
    if (check.data) return check.data.available ? 'available' : 'taken'

    return check.isError ? undefined : 'checking'
  }

  // Server answers only; the form's own errors show at their field.
  function messageKey() {
    if (create.error && !isSlugTaken(create.error)) return errorKeyOf(create.error)
    if (check.error) return errorKeyOf(check.error)

    return undefined
  }
}

function isSlugTaken(error: unknown) {
  return error instanceof ApiError && error.code === 'companies.slug_taken'
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

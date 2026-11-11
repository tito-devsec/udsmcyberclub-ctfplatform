import { useDocumentTitle } from '@mantine/hooks'
import { RANGE_NAME, useIsCtfRoute } from '@Hooks/useBrand'
import { useConfig } from '@Hooks/useConfig'

export const usePageTitle = (title?: string) => {
  const { config, error } = useConfig()
  const ctf = useIsCtfRoute()

  const platform = !ctf ? RANGE_NAME : error ? 'UD::CTF' : `${config?.title ?? 'UDSM-CTFPLATFORM'}::CTF`

  useDocumentTitle(typeof title === 'string' && title.trim().length > 0 ? `${title} - ${platform}` : platform)
}

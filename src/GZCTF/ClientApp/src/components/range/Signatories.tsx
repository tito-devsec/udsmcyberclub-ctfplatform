import { Button, FileButton, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { Signatory, signatoriesApi, useSignatories } from '@Utils/Community'
import { showErrorMsg } from '@Utils/Shared'
import { fileToDataUrl } from '@Utils/Studio'
import range from '@Styles/Range.module.css'
import classes from '@Styles/Studio.module.css'

type Slot = Signatory['slot']
type Names = Record<Slot, { name: string; title: string }>

const PICTURE_TYPES = 'image/png,image/jpeg,image/webp'
const PICTURE_SIZE = 300 * 1024

// Who signs certificates, for the superadmin: the two names, their titles and a picture of
// each signature.
export const SignatoriesCard: FC = () => {
  const { t } = useTranslation()
  const { data, mutate } = useSignatories()
  // what was typed and not saved yet
  const [typed, setTyped] = useState<Partial<Names>>({})
  const [busy, setBusy] = useState<string | null>(null)

  if (!data) return null

  const valueOf = (signatory: Signatory) => typed[signatory.slot] ?? { name: signatory.name, title: signatory.title }
  const changed = Object.keys(typed).length > 0
  const complete = data.every((signatory) => signatory.name && signatory.signature)

  const run = async (what: string, work: () => Promise<Signatory[] | void>) => {
    setBusy(what)
    try {
      const next = await work()
      if (next) await mutate(next, { revalidate: false })
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setBusy(null)
    }
  }

  const save = () =>
    run('save', async () => {
      const next = await signatoriesApi.save(typed)
      setTyped({})
      return next
    })

  const upload = (slot: Slot, file: File | null) => {
    if (!file) return
    if (file.size > PICTURE_SIZE) {
      showNotification({ color: 'red', message: t('range.signatories.too_large') })
      return
    }
    run(`upload-${slot}`, async () => signatoriesApi.upload(slot, await fileToDataUrl(file)))
  }

  const apply = () => {
    if (!window.confirm(t('range.signatories.apply_confirm'))) return
    run('apply', async () => {
      const { certificates } = await signatoriesApi.apply()
      showNotification({ color: 'teal', message: t('range.signatories.applied', { count: certificates }) })
    })
  }

  return (
    <section className={classes.panel}>
      <div className={classes.panelHead}>
        <h2>{t('range.signatories.title')}</h2>
        <Button loading={busy === 'save'} disabled={!changed} onClick={save} leftSection={<Uicon name="disk" />}>
          {t('range.studio.save')}
        </Button>
      </div>
      <p className={range.dim} style={{ margin: 0, maxWidth: 820 }}>
        {t('range.signatories.lead')}
      </p>

      <div className={classes.row}>
        {data.map((signatory) => {
          const value = valueOf(signatory)
          const set = (changes: Partial<Names[Slot]>) =>
            setTyped({ ...typed, [signatory.slot]: { ...value, ...changes } })
          return (
            <div key={signatory.slot} className={classes.item}>
              <div className={classes.itemHead}>{t(`range.signatories.slot.${signatory.slot}`)}</div>
              <TextInput
                label={t('range.signatories.name')}
                maxLength={80}
                value={value.name}
                onChange={(event) => set({ name: event.currentTarget.value })}
              />
              <TextInput
                label={t('range.signatories.role')}
                maxLength={80}
                value={value.title}
                onChange={(event) => set({ title: event.currentTarget.value })}
              />
              <div>
                <div style={{ marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>
                  {t('range.signatories.signature')}
                </div>
                <div className={classes.signature}>
                  {signatory.signature ? <img src={signatory.signature} alt="" /> : t('range.signatories.none')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <FileButton onChange={(file) => upload(signatory.slot, file)} accept={PICTURE_TYPES}>
                  {(props) => (
                    <Button
                      {...props}
                      variant="default"
                      loading={busy === `upload-${signatory.slot}`}
                      leftSection={<Uicon name="upload" />}
                    >
                      {t('range.signatories.upload')}
                    </Button>
                  )}
                </FileButton>
                {signatory.signature && (
                  <Button
                    variant="subtle"
                    color="red"
                    loading={busy === `remove-${signatory.slot}`}
                    onClick={() => run(`remove-${signatory.slot}`, () => signatoriesApi.remove(signatory.slot))}
                  >
                    {t('range.studio.remove')}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className={range.between} style={{ flexWrap: 'wrap' }}>
        <span className={range.dim} style={{ maxWidth: 720 }}>
          {t('range.signatories.apply_hint')}
        </span>
        <Button variant="default" loading={busy === 'apply'} disabled={!complete || changed} onClick={apply}>
          {t('range.signatories.apply')}
        </Button>
      </div>
    </section>
  )
}

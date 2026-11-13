import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { BoxFile, boxApi, boxFileUrl, fileSize, isPicture, readAsBase64 } from '@Utils/AttackBox'
import classes from '@Styles/AttackBox.module.css'
import homeIcon from '../../../assets/attackbox/home.svg'

interface BoxFilesProps {
  running: boolean
  // the largest file that may go in or out, in MB
  limit: number
  // opens a picture from the box in the picture viewer
  onOpenPicture: (path: string) => void
}

// The files in the attack box's home folder: sent in from the student's computer (they land in
// ~/uploads), fetched out of it, or opened in the picture viewer.
export const BoxFiles: FC<BoxFilesProps> = ({ running, limit, onOpenPicture }) => {
  const { t, i18n } = useTranslation()
  const [files, setFiles] = useState<BoxFile[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setFiles(await boxApi.files())
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [])

  // read again whenever the box starts
  useEffect(() => {
    if (!running) return
    let gone = false
    boxApi
      .files()
      .then((list) => {
        if (gone) return
        setFiles(list)
        setError(null)
      })
      .catch((failure) => !gone && setError(failure instanceof Error ? failure.message : String(failure)))
    return () => {
      gone = true
    }
  }, [running])

  const send = async (list: FileList | File[]) => {
    setError(null)
    for (const file of Array.from(list)) {
      if (file.size > limit * 1024 * 1024) {
        setError(t('range.box.files.too_large', { name: file.name, limit }))
        continue
      }
      setBusy(file.name)
      try {
        // names the box accepts: letters, digits, spaces, dots, dashes and _
        const name =
          file.name
            .replace(/[^A-Za-z0-9._ -]/g, '_')
            .replace(/^[^A-Za-z0-9]+/, '')
            .slice(0, 100) || 'upload'
        setFiles(await boxApi.upload(name, await readAsBase64(file)))
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    }
    setBusy(null)
  }

  const remove = async (path: string) => {
    if (!window.confirm(t('range.box.files.delete_confirm', { path }))) return
    setBusy(path)
    try {
      setFiles(await boxApi.remove(path))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(null)
    }
  }

  if (!running) {
    return (
      <div className={classes.notice}>
        <img src={homeIcon} alt="" />
        <p>{t('range.box.files.off')}</p>
      </div>
    )
  }

  return (
    <>
      <div className={classes.toolbar}>
        <button
          type="button"
          className={classes.button}
          data-tone="primary"
          onClick={() => picker.current?.click()}
          disabled={Boolean(busy)}
        >
          <Uicon name="upload" />
          {t('range.box.files.send')}
        </button>
        <button type="button" className={classes.button} onClick={() => void load()}>
          <Uicon name="refresh" />
          {t('range.box.files.refresh')}
        </button>
        <div className={classes.spacer} />
        <span style={{ fontSize: '0.78rem', color: 'var(--ab-dim)' }}>{t('range.box.files.where', { limit })}</span>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            if (event.currentTarget.files) void send(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
      </div>
      <div
        className={classes.drop}
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          void send(event.dataTransfer.files)
        }}
      >
        {busy ? t('range.box.files.working', { name: busy }) : t('range.box.files.drop')}
      </div>
      {error && (
        <div className={classes.error} style={{ padding: '0 12px 8px' }}>
          {error}
        </div>
      )}
      <div className={classes.scroll}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>{t('range.box.files.name')}</th>
              <th style={{ width: 90 }}>{t('range.box.files.size')}</th>
              <th style={{ width: 150 }}>{t('range.box.files.changed')}</th>
              <th style={{ width: 230 }} />
            </tr>
          </thead>
          <tbody>
            {files?.map((file) => (
              <tr key={file.path}>
                <td className={classes.mono} style={{ wordBreak: 'break-all' }}>
                  ~/{file.path}
                </td>
                <td>{fileSize(file.size)}</td>
                <td>
                  {new Date(file.changedAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td>
                  <div className={classes.actions}>
                    {isPicture(file.path) && (
                      <button type="button" className={classes.button} onClick={() => onOpenPicture(file.path)}>
                        <Uicon name="images" />
                        {t('range.box.files.view')}
                      </button>
                    )}
                    <a className={classes.button} href={boxFileUrl(file.path)} download>
                      <Uicon name="download" />
                      {t('range.box.files.fetch')}
                    </a>
                    <button
                      type="button"
                      className={classes.button}
                      data-tone="danger"
                      onClick={() => void remove(file.path)}
                      disabled={busy === file.path}
                      aria-label={t('range.box.files.delete')}
                    >
                      <Uicon name="trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {files && files.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--ab-dim)' }}>
                  {t('range.box.files.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

import { Button, CopyButton, Tooltip } from '@mantine/core'
import cx from 'clsx'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { Note } from '@Components/range/Parts'
import { MachineInfo, rangeApi } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import classes from '@Styles/Range.module.css'

interface MachineBlockProps {
  // the names this machine is kept under: a module and section, or a lab
  module: string
  section: string
  machine: MachineInfo | null | undefined
  // starts the machine of this section or lab
  start: () => Promise<MachineInfo>
  onChange: (machine: MachineInfo | null) => void
  // what the machine is, when it is not a section's
  description?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeLeft(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(seconds % 60)}` : `${pad(m)}:${pad(seconds % 60)}`
}

// The student's own target for a hands-on section: start it, reach it, extend it, stop it.
export const MachineBlock: FC<MachineBlockProps> = ({ module, section, machine, start, onChange, description }) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'start' | 'extend' | 'stop' | null>(null)
  // the countdown's clock, moved on every second while a machine runs
  const [now, setNow] = useState(() => Date.now())

  const mine = machine && machine.module === module && machine.section === section ? machine : null
  const other = machine && !mine ? machine : null

  useEffect(() => {
    if (!mine) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [mine])

  useEffect(() => {
    // the machine has expired: the service removes it, so stop showing it
    if (mine && new Date(mine.expiresAt).getTime() <= now) onChange(null)
  }, [mine, now, onChange])

  const run = async (action: 'start' | 'extend' | 'stop') => {
    setBusy(action)
    try {
      if (action === 'start') onChange(await start())
      else if (action === 'extend') onChange(await rangeApi.extendMachine())
      else {
        await rangeApi.stopMachine()
        onChange(null)
      }
    } catch (error) {
      showErrorMsg(error, t)
    } finally {
      setBusy(null)
    }
  }

  const url = mine ? `http://${mine.entry}` : ''

  return (
    <div className={cx(classes.card, classes.machine)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className={classes.machineIcon}>
          <Uicon name="computer" />
        </span>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{t('range.machine.title')}</div>
          <div className={classes.dim}>{description ?? t('range.machine.description')}</div>
        </div>
      </div>

      {other && (
        <div style={{ marginTop: 16 }}>
          <Note tone="warn" icon="triangle-warning">
            {t('range.machine.other', { title: other.title })}
          </Note>
        </div>
      )}

      <div className={classes.machineStage}>
        {mine ? (
          <>
            <div className={classes.address}>
              {url}
              <CopyButton value={url}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? t('range.machine.copied') : t('range.machine.copy')} withArrow>
                    <button
                      type="button"
                      className={classes.iconButton}
                      onClick={copy}
                      aria-label={t('range.machine.copy')}
                    >
                      <Uicon name={copied ? 'check' : 'copy-alt'} />
                    </button>
                  </Tooltip>
                )}
              </CopyButton>
              <Tooltip label={t('range.machine.open')} withArrow>
                <a
                  className={classes.iconButton}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('range.machine.open')}
                >
                  <Uicon name="arrow-up-right-from-square" />
                </a>
              </Tooltip>
            </div>
            <div className={classes.dim}>
              {t('range.machine.time_left')} <strong className={classes.mono}>{timeLeft(mine.expiresAt, now)}</strong>
            </div>
            <div className={classes.footActions}>
              <Tooltip label={t('range.machine.extend_hint')} disabled={mine.canExtend} withArrow multiline w={230}>
                <Button
                  variant="default"
                  radius="sm"
                  leftSection={<Uicon name="time-add" />}
                  disabled={!mine.canExtend}
                  loading={busy === 'extend'}
                  onClick={() => run('extend')}
                >
                  {t('range.machine.extend')}
                </Button>
              </Tooltip>
              <Button
                variant="light"
                color="red"
                radius="sm"
                leftSection={<Uicon name="stop-solid" />}
                loading={busy === 'stop'}
                onClick={() => run('stop')}
              >
                {t('range.machine.stop')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              size="md"
              radius="sm"
              leftSection={<Uicon name="play-solid" />}
              loading={busy === 'start'}
              onClick={() => run('start')}
            >
              {t('range.machine.start')}
            </Button>
            <span className={cx(classes.small, classes.dim)}>{t('range.machine.lifetime')}</span>
          </>
        )}
      </div>

      <div className={classes.between} style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <span className={classes.status} data-on={mine ? true : undefined}>
          {mine ? t('range.machine.running') : t('range.machine.offline')}
        </span>
        {mine && <span className={cx(classes.small, classes.dim)}>{t('range.machine.reload_hint')}</span>}
      </div>
    </div>
  )
}

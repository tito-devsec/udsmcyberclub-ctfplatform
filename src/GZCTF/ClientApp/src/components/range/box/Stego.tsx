import { FC, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { BoxFile, boxApi, boxFileUrl, isPicture } from '@Utils/AttackBox'
import classes from '@Styles/AttackBox.module.css'
import viewerIcon from '../../../assets/attackbox/image-viewer.svg'
import { asHex, asText, CHANNELS, extract, ExtractOptions, PLANE_MODES, render, ViewMode } from './pictureBits'

export type PictureSource = { kind: 'box'; path: string } | { kind: 'local'; file: File }

// the most pixels a picture may have here (4096 x 4096): beyond that the browser struggles
const MOST_PIXELS = 4096 * 4096

interface StegoViewerProps {
  running: boolean
  source: PictureSource | null
  onSource: (source: PictureSource) => void
}

// A picture viewer for hidden data, like StegSolve: each colour on its own, each bit of each
// colour, contrast stretched, every shade a different colour, and the hidden bits read out.
// Everything happens in the browser; a picture from the student's computer is never sent.
export const StegoViewer: FC<StegoViewerProps> = ({ running, source, onSource }) => {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [picture, setPicture] = useState<{ name: string; data: ImageData } | null>(null)
  // why the chosen picture could not be opened
  const [failed, setFailed] = useState<{ source: PictureSource; message: string } | null>(null)
  const [mode, setMode] = useState<ViewMode>('normal')
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [hover, setHover] = useState<string | null>(null)
  const [boxPictures, setBoxPictures] = useState<BoxFile[]>([])
  const [extracting, setExtracting] = useState(false)
  const [options, setOptions] = useState<ExtractOptions>({
    channels: [0],
    bit: 0,
    byColumns: false,
    msbFirst: true,
    stopAtZero: true,
  })

  useEffect(() => {
    if (!running) return
    boxApi
      .files()
      .then((files) => setBoxPictures(files.filter((file) => isPicture(file.path))))
      .catch(() => setBoxPictures([]))
  }, [running, source])

  // reads the chosen picture into its pixels
  useEffect(() => {
    if (!source) return
    let gone = false
    const load = async () => {
      const blob =
        source.kind === 'local'
          ? source.file
          : await fetch(boxFileUrl(source.path), { credentials: 'same-origin' }).then((res) => {
              if (!res.ok) throw new Error(t('range.box.stego.not_found'))
              return res.blob()
            })
      const bitmap = await createImageBitmap(blob)
      if (bitmap.width * bitmap.height > MOST_PIXELS) throw new Error(t('range.box.stego.too_large'))
      const scratch = document.createElement('canvas')
      scratch.width = bitmap.width
      scratch.height = bitmap.height
      const context = scratch.getContext('2d', { willReadFrequently: true })!
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return context.getImageData(0, 0, scratch.width, scratch.height)
    }
    load()
      .then((data) => {
        if (gone) return
        setPicture({ name: source.kind === 'box' ? `~/${source.path}` : source.file.name, data })
        setMode('normal')
      })
      .catch(
        (failure) =>
          !gone &&
          setFailed({ source, message: failure instanceof Error ? failure.message : t('range.box.stego.unreadable') })
      )
    return () => {
      gone = true
    }
  }, [source, t])

  // draws the picture as the mode shows it
  useEffect(() => {
    const target = canvas.current
    if (!target || !picture) return
    target.width = picture.data.width
    target.height = picture.data.height
    target.getContext('2d')!.putImageData(render(picture.data, mode), 0, 0)
  }, [picture, mode])

  const hidden = useMemo(
    () => (picture && extracting && options.channels.length ? extract(picture.data, options) : null),
    [picture, extracting, options]
  )

  const download = (blob: Blob, name: string) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 5000)
  }

  const pixel = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picture) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - box.left) * picture.data.width) / box.width)
    const y = Math.floor(((event.clientY - box.top) * picture.data.height) / box.height)
    if (x < 0 || y < 0 || x >= picture.data.width || y >= picture.data.height) return setHover(null)
    const i = (y * picture.data.width + x) * 4
    const [r, g, b, a] = picture.data.data.slice(i, i + 4)
    setHover(`x ${x}, y ${y}   R ${r}  G ${g}  B ${b}  A ${a}`)
  }

  const option = <K extends keyof ExtractOptions>(key: K, value: ExtractOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }))

  const pictures = running ? boxPictures : []
  const error = failed && failed.source === source ? failed.message : null

  const size =
    picture && zoom !== 'fit'
      ? { width: picture.data.width * zoom, height: picture.data.height * zoom }
      : { maxWidth: '100%', maxHeight: '100%' }

  return (
    <>
      <div className={classes.toolbar}>
        <select
          className={classes.select}
          value=""
          onChange={(event) => event.currentTarget.value && onSource({ kind: 'box', path: event.currentTarget.value })}
          disabled={!running || pictures.length === 0}
          aria-label={t('range.box.stego.from_box')}
        >
          <option value="">{running ? t('range.box.stego.from_box') : t('range.box.stego.box_off')}</option>
          {pictures.map((file) => (
            <option key={file.path} value={file.path}>
              ~/{file.path}
            </option>
          ))}
        </select>
        <button type="button" className={classes.button} onClick={() => picker.current?.click()}>
          <Uicon name="folder" />
          {t('range.box.stego.from_computer')}
        </button>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onSource({ kind: 'local', file })
            event.currentTarget.value = ''
          }}
        />
        <select
          className={classes.select}
          value={mode}
          onChange={(event) => setMode(event.currentTarget.value as ViewMode)}
          disabled={!picture}
          aria-label={t('range.box.stego.mode')}
        >
          <optgroup label={t('range.box.stego.group.whole')}>
            {(['normal', 'stretch', 'random', 'invert', 'gray'] as const).map((m) => (
              <option key={m} value={m}>
                {t(`range.box.stego.view.${m}`)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('range.box.stego.group.colours')}>
            {(['red', 'green', 'blue', 'alpha'] as const).map((m) => (
              <option key={m} value={m}>
                {t(`range.box.stego.view.${m}`)}
              </option>
            ))}
          </optgroup>
          {CHANNELS.map((c) => (
            <optgroup key={c} label={t(`range.box.stego.group.plane_${c}`)}>
              {PLANE_MODES.filter((m) => m.startsWith(`plane-${c}`)).map((m) => (
                <option key={m} value={m}>
                  {t('range.box.stego.view.bit', { colour: t(`range.box.stego.colour.${c}`), bit: m.slice(-1) })}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className={classes.select}
          value={String(zoom)}
          onChange={(event) => setZoom(event.currentTarget.value === 'fit' ? 'fit' : Number(event.currentTarget.value))}
          disabled={!picture}
          aria-label={t('range.box.stego.zoom')}
        >
          <option value="fit">{t('range.box.stego.fit')}</option>
          {[1, 2, 4, 8].map((n) => (
            <option key={n} value={n}>
              {n * 100}%
            </option>
          ))}
        </select>
        <div className={classes.spacer} />
        <button type="button" className={classes.button} onClick={() => setExtracting((on) => !on)} disabled={!picture}>
          <Uicon name="binary" />
          {t('range.box.stego.extract')}
        </button>
        <button
          type="button"
          className={classes.button}
          onClick={() => canvas.current?.toBlob((blob) => blob && download(blob, `view-${mode}.png`), 'image/png')}
          disabled={!picture}
        >
          <Uicon name="download" />
          {t('range.box.stego.save')}
        </button>
      </div>

      <div className={classes.canvasArea}>
        {picture && <canvas ref={canvas} style={size} onMouseMove={pixel} onMouseLeave={() => setHover(null)} />}
      </div>
      {!picture && (
        <div className={classes.notice} style={{ top: 37 }}>
          <img src={viewerIcon} alt="" />
          <p>{error ?? t('range.box.stego.empty')}</p>
        </div>
      )}

      {picture && extracting && (
        <div className={classes.extract}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {CHANNELS.map((c, index) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={options.channels.includes(index)}
                  onChange={(event) => {
                    const on = event.currentTarget.checked
                    option(
                      'channels',
                      on ? [...options.channels, index].sort() : options.channels.filter((x) => x !== index)
                    )
                  }}
                />
                {t(`range.box.stego.colour.${c}`)}
              </label>
            ))}
            <label>
              {t('range.box.stego.bit')}
              <select
                className={classes.select}
                value={options.bit}
                onChange={(event) => option('bit', Number(event.currentTarget.value))}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.msbFirst}
                onChange={(event) => option('msbFirst', event.currentTarget.checked)}
              />
              {t('range.box.stego.msb_first')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.byColumns}
                onChange={(event) => option('byColumns', event.currentTarget.checked)}
              />
              {t('range.box.stego.by_columns')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.stopAtZero}
                onChange={(event) => option('stopAtZero', event.currentTarget.checked)}
              />
              {t('range.box.stego.stop_at_zero')}
            </label>
            <div className={classes.spacer} />
            <button
              type="button"
              className={classes.button}
              onClick={() => hidden && download(new Blob([hidden.slice().buffer]), 'hidden-bits.bin')}
              disabled={!hidden?.length}
            >
              {t('range.box.stego.save_bytes')}
            </button>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ab-dim)' }}>
            {t('range.box.stego.found', { count: hidden?.length ?? 0 })}
          </div>
          <pre>{hidden && hidden.length ? asText(hidden.subarray(0, 4096)) : '—'}</pre>
          <pre>{hidden && hidden.length ? asHex(hidden) : '—'}</pre>
        </div>
      )}

      <div className={classes.statusbar}>
        <span>
          {picture ? `${picture.name} · ${picture.data.width} × ${picture.data.height}` : t('range.box.stego.nothing')}
        </span>
        <span className={classes.mono}>{hover ?? ''}</span>
      </div>
    </>
  )
}

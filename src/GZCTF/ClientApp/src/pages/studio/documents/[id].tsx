import { Button, FileButton, NumberInput, Select, Switch, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import cx from 'clsx'
import { FC, ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { Note, PoweredBy } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import {
  IconButton,
  ItemControls,
  MachineFields,
  MarkdownField,
  moved,
  QuestionsEditor,
  replaced,
  StatusChip,
  without,
} from '@Components/range/Studio'
import { ago } from '@Utils/Community'
import { CATEGORIES, Category, DIFFICULTIES, Difficulty, useModules, useRangeRefresh } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import {
  documentsApi,
  fileToDataUrl,
  LabDraft,
  ModuleDraft,
  PathDraft,
  SectionDraft,
  StudioDocument,
  studioUrl,
  useDocument,
  useMachineImages,
} from '@Utils/Studio'
import { uicons } from '@Utils/Uicons'
import { usePageTitle } from '@Hooks/usePageTitle'
import range from '@Styles/Range.module.css'
import classes from '@Styles/Studio.module.css'

const ICONS = Object.keys(uicons).filter((name) => !name.endsWith('-brands') && !name.endsWith('-solid'))
const FILE_SIZE = 8 * 1024 * 1024

// what a module, a lab and a path have in common; the parts one of them lacks stay undefined
interface Details {
  title: string
  summary: string
  description?: string
  category?: Category
  difficulty: Difficulty
  minutes?: number
  icon?: string
}

interface DetailsProps {
  value: Details
  onChange: (changes: Partial<Details>) => void
  children?: ReactNode
}

// The title, the summary and the facts shown on a card.
const DetailsFields: FC<DetailsProps> = ({ value, onChange, children }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className={classes.row}>
        <TextInput
          label={t('range.studio.column.title')}
          maxLength={120}
          value={value.title}
          onChange={(event) => onChange({ title: event.currentTarget.value })}
        />
        <TextInput
          label={t('range.studio.summary')}
          description={t('range.studio.summary_hint')}
          maxLength={300}
          value={value.summary}
          onChange={(event) => onChange({ summary: event.currentTarget.value })}
        />
      </div>
      {value.description !== undefined && (
        <MarkdownField
          label={t('range.studio.description')}
          value={value.description}
          onChange={(description) => onChange({ description })}
          minRows={4}
        />
      )}
      <div className={classes.row}>
        {value.category !== undefined && (
          <Select
            label={t('range.lab.category')}
            data={CATEGORIES.map((category) => ({ value: category, label: t(`range.category.${category}`) }))}
            value={value.category}
            onChange={(category) => category && onChange({ category: category as Category })}
            allowDeselect={false}
            searchable
          />
        )}
        <Select
          label={t('range.filter.difficulty')}
          data={DIFFICULTIES.map((difficulty) => ({ value: difficulty, label: t(`range.difficulty.${difficulty}`) }))}
          value={value.difficulty}
          onChange={(difficulty) => difficulty && onChange({ difficulty: difficulty as Difficulty })}
          allowDeselect={false}
        />
        {value.minutes !== undefined && (
          <NumberInput
            label={t('range.studio.minutes')}
            min={1}
            max={100000}
            value={value.minutes}
            onChange={(minutes) => onChange({ minutes: Number(minutes) || 30 })}
          />
        )}
        <Select
          label={t('range.studio.icon')}
          description={t('range.studio.icon_hint')}
          data={ICONS}
          value={value.icon ?? null}
          onChange={(icon) => onChange({ icon: icon ?? undefined })}
          leftSection={
            value.icon && value.icon in uicons ? <Uicon name={value.icon as keyof typeof uicons} /> : undefined
          }
          searchable
          clearable
        />
        {children}
      </div>
    </>
  )
}

interface EditorProps<T> {
  value: T
  onChange: (value: T) => void
  // the Docker images that may be used as machines
  images: string[]
}

type Chapter = ModuleDraft['chapters'][number]
type Selected =
  { at: 'details' } | { at: 'chapter'; chapter: number } | { at: 'section'; chapter: number; section: number }

const newSection = (): SectionDraft => ({ title: '', content: '', xp: 10 })

// Without a machine flag to ask for, questions that asked for it ask for an answer again.
const withoutFlagQuestions = <T extends { flag?: boolean; answer?: string[] }>(questions: T[] | undefined) =>
  questions?.map((question) => (question.flag ? { ...question, flag: undefined, answer: [] } : question))

// A module: its details, then its chapters of sections, picked from the outline on the left.
const ModuleEditor: FC<EditorProps<ModuleDraft>> = ({ value, onChange, images }) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Selected>({ at: 'details' })
  const chapters = value.chapters
  // what was selected may have been removed since
  const chapter = selected.at === 'details' ? undefined : chapters[selected.chapter]
  const section = selected.at === 'section' ? chapter?.sections[selected.section] : undefined

  const setChapters = (next: Chapter[]) => onChange({ ...value, chapters: next })
  const setChapter = (index: number, changes: Partial<Chapter>) =>
    setChapters(replaced(chapters, index, { ...chapters[index], ...changes }))
  const setSection = (changes: Partial<SectionDraft>) => {
    if (selected.at !== 'section' || !chapter || !section) return
    setChapter(selected.chapter, {
      sections: replaced(chapter.sections, selected.section, { ...section, ...changes }),
    })
  }

  return (
    <div className={classes.columns}>
      <nav className={classes.outline}>
        <button
          type="button"
          className={classes.outlineItem}
          data-active={selected.at === 'details' || undefined}
          onClick={() => setSelected({ at: 'details' })}
        >
          <Uicon name="book-open-cover" />
          <span>{t('range.studio.module.details')}</span>
        </button>
        {chapters.map((item, c) => (
          <div key={c} style={{ display: 'grid', gap: 4 }}>
            <div className={classes.outlineChapter}>
              <button
                type="button"
                className={classes.outlineItem}
                data-active={(selected.at === 'chapter' && selected.chapter === c) || undefined}
                onClick={() => setSelected({ at: 'chapter', chapter: c })}
              >
                <span>{item.title || t('range.studio.module.chapter', { n: c + 1 })}</span>
              </button>
              <IconButton
                icon="plus"
                label={t('range.studio.module.add_section')}
                onClick={() => {
                  setChapter(c, { sections: [...item.sections, newSection()] })
                  setSelected({ at: 'section', chapter: c, section: item.sections.length })
                }}
              />
            </div>
            {item.sections.map((entry, s) => (
              <button
                key={s}
                type="button"
                className={classes.outlineItem}
                data-level="section"
                data-active={
                  (selected.at === 'section' && selected.chapter === c && selected.section === s) || undefined
                }
                onClick={() => setSelected({ at: 'section', chapter: c, section: s })}
              >
                <span>{entry.title || t('range.studio.module.section', { n: s + 1 })}</span>
              </button>
            ))}
          </div>
        ))}
        <button
          type="button"
          className={range.button}
          data-variant="subtle"
          style={{ marginTop: 8 }}
          onClick={() => {
            setChapters([...chapters, { title: '', sections: [newSection()] }])
            setSelected({ at: 'chapter', chapter: chapters.length })
          }}
        >
          <Uicon name="plus" />
          {t('range.studio.module.add_chapter')}
        </button>
      </nav>

      <div style={{ display: 'grid', gap: 24, minWidth: 0 }}>
        {selected.at === 'details' || !chapter ? (
          <section className={classes.panel}>
            <div className={classes.panelHead}>
              <h2>{t('range.studio.module.details')}</h2>
            </div>
            <DetailsFields value={value} onChange={(changes) => onChange({ ...value, ...changes })} />
            <Switch
              label={t('range.studio.module.sequential')}
              description={t('range.studio.module.sequential_hint')}
              checked={value.sequential}
              onChange={(event) => onChange({ ...value, sequential: event.currentTarget.checked })}
            />
          </section>
        ) : selected.at === 'chapter' || !section ? (
          <section className={classes.panel}>
            <div className={classes.panelHead}>
              <h2>{t('range.studio.module.chapter', { n: selected.chapter + 1 })}</h2>
              <ItemControls
                index={selected.chapter}
                count={chapters.length}
                onMove={(by) => {
                  setChapters(moved(chapters, selected.chapter, by))
                  setSelected({ at: 'chapter', chapter: selected.chapter + by })
                }}
                onRemove={() => {
                  setChapters(without(chapters, selected.chapter))
                  setSelected({ at: 'details' })
                }}
              />
            </div>
            <TextInput
              label={t('range.studio.column.title')}
              description={t('range.studio.module.chapter_hint')}
              maxLength={120}
              value={chapter.title}
              onChange={(event) => setChapter(selected.chapter, { title: event.currentTarget.value })}
            />
          </section>
        ) : (
          <>
            <section className={classes.panel}>
              <div className={classes.panelHead}>
                <h2>{section.title || t('range.studio.module.section', { n: selected.section + 1 })}</h2>
                <ItemControls
                  index={selected.section}
                  count={chapter.sections.length}
                  onMove={(by) => {
                    setChapter(selected.chapter, { sections: moved(chapter.sections, selected.section, by) })
                    setSelected({ ...selected, section: selected.section + by })
                  }}
                  onRemove={() => {
                    setChapter(selected.chapter, { sections: without(chapter.sections, selected.section) })
                    setSelected({ at: 'chapter', chapter: selected.chapter })
                  }}
                />
              </div>
              <div className={classes.row}>
                <TextInput
                  label={t('range.studio.column.title')}
                  maxLength={120}
                  value={section.title}
                  onChange={(event) => setSection({ title: event.currentTarget.value })}
                />
                <NumberInput
                  label={t('range.studio.module.bonus')}
                  description={t('range.studio.module.bonus_hint')}
                  min={0}
                  max={1000}
                  value={section.xp}
                  onChange={(xp) => setSection({ xp: Number(xp) || 0 })}
                />
              </div>
              <MarkdownField
                label={t('range.studio.module.text')}
                value={section.content}
                onChange={(content) => setSection({ content })}
                minRows={14}
              />
            </section>
            <section className={classes.panel}>
              <div className={classes.panelHead}>
                <h2>{t('range.studio.machine.title')}</h2>
              </div>
              <MachineFields
                value={section.machine}
                images={images}
                onChange={(machine) =>
                  setSection({
                    machine,
                    questions: machine?.flag ? section.questions : withoutFlagQuestions(section.questions),
                  })
                }
              />
            </section>
            <section className={classes.panel}>
              <div className={classes.panelHead}>
                <h2>{t('range.studio.question.title')}</h2>
              </div>
              <QuestionsEditor
                noun="question"
                value={section.questions ?? []}
                onChange={(questions) => setSection({ questions })}
                canFlag={Boolean(section.machine?.flag)}
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

interface LabEditorProps extends EditorProps<LabDraft> {
  id: string
  files: { name: string; size: number }[]
  // files are kept apart from the draft: changing one gives back the document as it now is
  onFiles: (document: StudioDocument) => void
}

const sizeOf = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`

// A lab: its details, its scenario, a machine or files to work on, and its tasks.
const LabEditor: FC<LabEditorProps> = ({ value, onChange, images, id, files, onFiles }) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const change = async (work: () => Promise<StudioDocument>) => {
    setBusy(true)
    try {
      onFiles(await work())
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setBusy(false)
    }
  }

  const addFile = (file: File | null) => {
    if (!file) return
    if (file.size > FILE_SIZE) {
      showNotification({ color: 'red', message: t('range.studio.lab.file_too_large') })
      return
    }
    // names keep letters, digits, dots, dashes and _
    const name = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[^A-Za-z0-9]+/, '') || 'file'
    change(async () => documentsApi.addFile(id, name, (await fileToDataUrl(file)).split(',')[1] ?? ''))
  }

  return (
    <>
      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2>{t('range.studio.lab.details')}</h2>
        </div>
        <DetailsFields value={value} onChange={(changes) => onChange({ ...value, ...changes })}>
          <NumberInput
            label={t('range.studio.lab.bonus')}
            description={t('range.studio.lab.bonus_hint')}
            min={0}
            max={1000}
            value={value.bonus}
            onChange={(bonus) => onChange({ ...value, bonus: Number(bonus) || 0 })}
          />
        </DetailsFields>
        <MarkdownField
          label={t('range.lab.scenario')}
          value={value.scenario}
          onChange={(scenario) => onChange({ ...value, scenario })}
          minRows={6}
        />
      </section>

      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2>{t('range.studio.machine.title')}</h2>
        </div>
        <MachineFields
          value={value.machine}
          images={images}
          onChange={(machine) =>
            onChange({ ...value, machine, tasks: machine?.flag ? value.tasks : withoutFlagQuestions(value.tasks) })
          }
        />
      </section>

      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2>{t('range.lab.files')}</h2>
          <FileButton onChange={addFile}>
            {(props) => (
              <Button
                {...props}
                variant="default"
                loading={busy}
                disabled={files.length >= 5}
                leftSection={<Uicon name="upload" />}
              >
                {t('range.studio.lab.add_file')}
              </Button>
            )}
          </FileButton>
        </div>
        <p className={range.dim} style={{ margin: 0 }}>
          {t('range.studio.lab.files_hint')}
        </p>
        {files.map((file) => (
          <div key={file.name} className={range.between}>
            <span style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {file.name} <span className={range.dim}>{sizeOf(file.size)}</span>
            </span>
            <IconButton
              icon="trash"
              label={t('range.studio.remove')}
              onClick={() => change(() => documentsApi.removeFile(id, file.name))}
              disabled={busy}
              danger
            />
          </div>
        ))}
      </section>

      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2>{t('range.lab.tasks')}</h2>
        </div>
        <QuestionsEditor
          noun="task"
          value={value.tasks ?? []}
          onChange={(tasks) => onChange({ ...value, tasks })}
          canFlag={Boolean(value.machine?.flag)}
        />
      </section>
    </>
  )
}

// A skill path: its details, and its modules in order.
const PathEditor: FC<EditorProps<PathDraft>> = ({ value, onChange }) => {
  const { t } = useTranslation()
  const { data: modules = [] } = useModules()
  const titleOf = (slug: string) => modules.find((module) => module.slug === slug)?.title
  const setModules = (next: string[]) => onChange({ ...value, modules: next })

  return (
    <>
      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2>{t('range.studio.path.details')}</h2>
        </div>
        <DetailsFields value={value} onChange={(changes) => onChange({ ...value, ...changes })} />
      </section>

      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2>{t('range.studio.path.modules')}</h2>
        </div>
        <p className={range.dim} style={{ margin: 0 }}>
          {t('range.studio.path.modules_hint')}
        </p>
        {value.modules.map((slug, index) => (
          <div key={slug} className={range.between}>
            <span>
              <strong>{index + 1}.</strong> {titleOf(slug) ?? t('range.studio.path.offline', { name: slug })}
            </span>
            <ItemControls
              index={index}
              count={value.modules.length}
              onMove={(by) => setModules(moved(value.modules, index, by))}
              onRemove={() => setModules(without(value.modules, index))}
            />
          </div>
        ))}
        <Select
          placeholder={t('range.studio.path.add_module')}
          aria-label={t('range.studio.path.add_module')}
          data={modules
            .filter((module) => !value.modules.includes(module.slug))
            .map((module) => ({ value: module.slug, label: module.title }))}
          value={null}
          onChange={(slug) => slug && setModules([...value.modules, slug])}
          searchable
          disabled={value.modules.length >= 30}
        />
      </section>
    </>
  )
}

// One document of the studio: a module, a lab or a skill path, written here and then
// published. Students see the published version until the next one is published.
const DocumentPage: FC = () => {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const refresh = useRangeRefresh()
  const { data, error, mutate } = useDocument(id)
  const document = data?.id === id ? data : undefined
  const { data: images = [] } = useMachineImages(Boolean(document))
  // what was changed here and not saved yet
  const [edited, setEdited] = useState<StudioDocument['data'] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const value = edited ?? document?.data
  usePageTitle(value?.title || t('range.studio.untitled'))

  // Runs one action; whatever it returns becomes the document on screen.
  const run = async (what: string, work: () => Promise<StudioDocument | void>) => {
    setBusy(what)
    try {
      const next = await work()
      if (next) {
        await mutate(next, { revalidate: false })
        setEdited(null)
      }
      refresh()
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setBusy(null)
    }
  }

  const save = () => run('save', () => documentsApi.save(id, value))
  const publish = () =>
    run('publish', async () => {
      if (edited) await mutate(await documentsApi.save(id, edited), { revalidate: false })
      setEdited(null)
      const next = await documentsApi.publish(id)
      showNotification({ color: 'teal', message: t('range.studio.published_note') })
      return next
    })
  const unpublish = () => {
    if (!window.confirm(t('range.studio.unpublish_confirm'))) return
    run('unpublish', () => documentsApi.unpublish(id))
  }
  const remove = () => {
    if (!window.confirm(t('range.studio.delete_confirm'))) return
    run('remove', async () => {
      await documentsApi.remove(id)
      navigate(studioUrl.home)
    })
  }

  return (
    <RangePage isLoading={!document && !error}>
      <div className={cx(range.container, range.page)}>
        <Link to={studioUrl.home} className={range.link} style={{ display: 'inline-block', marginBottom: 20 }}>
          {t('range.studio.back')}
        </Link>

        {error && (
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.studio.not_found') : error.message}
          </Note>
        )}

        {document && value && (
          <div className={classes.form}>
            <div className={classes.bar}>
              <div className={classes.barTitle}>
                <h1>{value.title || t('range.studio.untitled')}</h1>
                <div className={range.labels}>
                  <span className={classes.status}>{t(`range.studio.kind.${document.kind}`)}</span>
                  <StatusChip status={document.status} />
                  <span className={range.dim}>
                    {t('range.studio.by', { name: document.mine ? t('range.studio.you') : document.author })} ·{' '}
                    {ago(document.updatedAt, i18n.language)} · /{document.kind}s/{document.slug}
                  </span>
                </div>
              </div>
              <div className={classes.actions}>
                <Button
                  variant="default"
                  loading={busy === 'save'}
                  disabled={!edited}
                  onClick={save}
                  leftSection={<Uicon name="disk" />}
                >
                  {t('range.studio.save')}
                </Button>
                <Button
                  loading={busy === 'publish'}
                  disabled={document.status === 'published' && !edited}
                  onClick={publish}
                  leftSection={<Uicon name="rocket" />}
                >
                  {t(document.status === 'draft' ? 'range.studio.publish' : 'range.studio.publish_changes')}
                </Button>
                {document.address && (
                  <Button component={Link} to={document.address} variant="default" leftSection={<Uicon name="eye" />}>
                    {t('range.studio.view')}
                  </Button>
                )}
                {document.status !== 'draft' ? (
                  <Button variant="subtle" color="red" loading={busy === 'unpublish'} onClick={unpublish}>
                    {t('range.studio.unpublish')}
                  </Button>
                ) : (
                  <Button variant="subtle" color="red" loading={busy === 'remove'} onClick={remove}>
                    {t('range.studio.delete')}
                  </Button>
                )}
              </div>
            </div>

            {document.problem && (
              <Note icon="info">
                {t('range.studio.not_ready')} {document.problem}
              </Note>
            )}
            {document.status === 'changed' && !document.problem && (
              <Note icon="clock">{t('range.studio.changed_note')}</Note>
            )}

            {document.kind === 'module' && (
              <ModuleEditor value={value as ModuleDraft} onChange={setEdited} images={images} />
            )}
            {document.kind === 'lab' && (
              <LabEditor
                value={value as LabDraft}
                onChange={setEdited}
                images={images}
                id={id}
                files={document.files}
                onFiles={(next) => mutate(next, { revalidate: false })}
              />
            )}
            {document.kind === 'path' && <PathEditor value={value as PathDraft} onChange={setEdited} images={images} />}
          </div>
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default DocumentPage

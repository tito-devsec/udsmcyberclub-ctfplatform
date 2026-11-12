import { Button, Modal, Stack, TextInput } from '@mantine/core'
import cx from 'clsx'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { Note, PoweredBy } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { StatusChip } from '@Components/range/Studio'
import { ago, shortDate } from '@Utils/Community'
import { useMe } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import {
  DocumentKind,
  documentsApi,
  proposalsApi,
  ProposalSummary,
  studioUrl,
  useDocuments,
  useProposals,
} from '@Utils/Studio'
import { UiconName } from '@Utils/Uicons'
import { usePageTitle } from '@Hooks/usePageTitle'
import community from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'
import classes from '@Styles/Studio.module.css'

const KIND_ICON: Record<DocumentKind, UiconName> = { module: 'book-open-cover', lab: 'flask', path: 'route' }
const KINDS: DocumentKind[] = ['module', 'lab', 'path']

// The studio: what tutors and admins are writing, the games they proposed, and for the
// superadmin the proposals to review and the signatures on certificates.
const StudioPage: FC = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data: me, error: meError, known, signedIn } = useMe()
  const staff = Boolean(me && me.role !== 'student')
  const superadmin = me?.role === 'superadmin'
  const { data: proposals } = useProposals(staff)
  const { data: documents } = useDocuments(staff)
  // the kind of document being named, before it is created
  const [naming, setNaming] = useState<DocumentKind | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  usePageTitle(t('range.studio.title'))

  // whether the visitor may be here is known once the platform and the service have answered
  const refused = known && (!signedIn || Boolean(meError) || (me && !staff))
  const waiting = superadmin ? (proposals?.filter((proposal) => proposal.status === 'submitted') ?? []) : []

  const create = async () => {
    if (!naming) return
    setBusy(true)
    try {
      navigate(studioUrl.document((await documentsApi.create(naming, title.trim())).id))
    } catch (failure) {
      showErrorMsg(failure, t)
      setBusy(false)
    }
  }

  const propose = async () => {
    setBusy(true)
    try {
      navigate(studioUrl.proposal((await proposalsApi.create({})).id))
    } catch (failure) {
      showErrorMsg(failure, t)
      setBusy(false)
    }
  }

  const proposalRow = (proposal: ProposalSummary) => (
    <tr key={proposal.id}>
      <td>
        <Link to={studioUrl.proposal(proposal.id)} className={community.playerName}>
          <Uicon name="gamepad" />
          {proposal.title || t('range.studio.untitled')}
        </Link>
      </td>
      <td>{proposal.mine ? t('range.studio.you') : proposal.author}</td>
      <td>
        <StatusChip status={proposal.status} />
      </td>
      <td>{proposal.challenges}</td>
      <td>{proposal.start ? shortDate(proposal.start, i18n.language) : '-'}</td>
      <td>{ago(proposal.updatedAt, i18n.language)}</td>
    </tr>
  )

  return (
    <RangePage isLoading={!refused && (!proposals || !documents)}>
      <div className={cx(range.container, range.page)}>
        <div className={range.sectionHead} style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span className={range.headingIcon}>
              <Uicon name="chalkboard-user" />
            </span>
            <div>
              <h1 className={range.pageTitle} style={{ fontSize: '2.4rem' }}>
                {t('range.studio.title')}
              </h1>
              <p className={range.lead} style={{ marginTop: 4, maxWidth: 780 }}>
                {t('range.studio.lead')}
              </p>
            </div>
          </div>
        </div>

        {refused && (
          <Note tone="warn" icon="triangle-warning">
            {t('range.studio.refused')}
          </Note>
        )}

        {proposals && documents && (
          <div className={classes.form}>
            <div className={classes.actions}>
              {KINDS.map((kind) => (
                <Button
                  key={kind}
                  size="md"
                  radius="sm"
                  leftSection={<Uicon name={KIND_ICON[kind]} />}
                  onClick={() => {
                    setTitle('')
                    setNaming(kind)
                  }}
                >
                  {t(`range.studio.new.${kind}`)}
                </Button>
              ))}
              <Button
                size="md"
                radius="sm"
                variant="default"
                loading={busy && !naming}
                leftSection={<Uicon name="gamepad" />}
                onClick={propose}
              >
                {t('range.studio.new.proposal')}
              </Button>
            </div>

            {waiting.length > 0 && (
              <section className={classes.panel}>
                <div className={classes.panelHead}>
                  <h2>{t('range.studio.waiting', { count: waiting.length })}</h2>
                </div>
                {waiting.map((proposal) => (
                  <div key={proposal.id} className={range.between} style={{ flexWrap: 'wrap' }}>
                    <span>
                      <strong>{proposal.title}</strong>
                      <span className={range.dim}>
                        {' '}
                        · {proposal.author} · {t('range.studio.proposal.challenges', { count: proposal.challenges })}
                      </span>
                    </span>
                    <Button component={Link} to={studioUrl.proposal(proposal.id)} radius="sm">
                      {t('range.studio.review')}
                    </Button>
                  </div>
                ))}
              </section>
            )}

            <section>
              <h2 className={range.blockTitle}>{t('range.studio.documents')}</h2>
              {documents.length > 0 ? (
                <div className={community.tableWrap}>
                  <table className={community.table}>
                    <thead>
                      <tr>
                        <th>{t('range.studio.column.title')}</th>
                        <th>{t('range.studio.column.kind')}</th>
                        <th>{t('range.studio.column.author')}</th>
                        <th>{t('range.studio.column.status')}</th>
                        <th>{t('range.studio.column.updated')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td>
                            <Link to={studioUrl.document(document.id)} className={community.playerName}>
                              <Uicon name={KIND_ICON[document.kind]} />
                              {document.title || t('range.studio.untitled')}
                            </Link>
                          </td>
                          <td>{t(`range.studio.kind.${document.kind}`)}</td>
                          <td>{document.mine ? t('range.studio.you') : document.author}</td>
                          <td>
                            <StatusChip status={document.status} />
                          </td>
                          <td>{ago(document.updatedAt, i18n.language)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {document.address && (
                              <Link to={document.address} className={range.link}>
                                {t('range.studio.view')}
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={cx(range.card, range.empty)}>{t('range.studio.no_documents')}</div>
              )}
            </section>

            <section>
              <h2 className={range.blockTitle}>{t('range.studio.proposals')}</h2>
              {proposals.length > 0 ? (
                <div className={community.tableWrap}>
                  <table className={community.table}>
                    <thead>
                      <tr>
                        <th>{t('range.studio.column.game')}</th>
                        <th>{t('range.studio.column.author')}</th>
                        <th>{t('range.studio.column.status')}</th>
                        <th>{t('range.studio.column.challenges')}</th>
                        <th>{t('range.studio.column.starts')}</th>
                        <th>{t('range.studio.column.updated')}</th>
                      </tr>
                    </thead>
                    <tbody>{proposals.map(proposalRow)}</tbody>
                  </table>
                </div>
              ) : (
                <div className={cx(range.card, range.empty)}>{t('range.studio.no_proposals')}</div>
              )}
            </section>

            {superadmin && (
              <section className={classes.panel}>
                <div className={classes.panelHead}>
                  <h2>{t('range.certificates.title')}</h2>
                  <Button component={Link} to="/studio/certificates" radius="sm" leftSection={<Uicon name="diploma" />}>
                    {t('range.certificates.open')}
                  </Button>
                </div>
                <p className={range.dim} style={{ margin: 0, maxWidth: 820 }}>
                  {t('range.certificates.lead')}
                </p>
              </section>
            )}
          </div>
        )}

        <Modal
          opened={naming !== null}
          onClose={() => setNaming(null)}
          title={naming && t(`range.studio.new.${naming}`)}
        >
          <Stack>
            <TextInput
              data-autofocus
              label={t('range.studio.column.title')}
              description={t('range.studio.title_hint')}
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && title.trim().length >= 3) create()
              }}
            />
            <Button loading={busy} disabled={title.trim().length < 3} onClick={create}>
              {t('range.studio.create')}
            </Button>
          </Stack>
        </Modal>

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default StudioPage

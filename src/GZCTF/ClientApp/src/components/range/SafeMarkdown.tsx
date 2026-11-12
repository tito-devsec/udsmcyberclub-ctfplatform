import { Typography } from '@mantine/core'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { FC, Suspense, useMemo } from 'react'
import { ContentPlaceholder } from '@Components/MarkdownRenderer'
import { KatexExtension } from '@Utils/marked/KatexExtension'
import { ShikiExtension } from '@Utils/marked/ShikiExtension'
import classes from '@Styles/Typography.module.css'

// Rendered like the rest of the platform's Markdown, then cleaned of anything that could
// run in the reader's browser (scripts, event handlers, javascript: links). Lessons and labs
// can be written by tutors in the studio, so their text is never trusted as HTML.
const SafeRenderer: FC<{ source: string }> = ({ source }) => {
  const marked = useMemo(
    () => new Marked().use(KatexExtension()).use(ShikiExtension()).setOptions({ silent: true }),
    []
  )
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source) as string), [marked, source])
  return <div className={classes.root} dangerouslySetInnerHTML={{ __html: html }} />
}

export const SafeMarkdown: FC<{ source: string; className?: string }> = ({ source, className }) => (
  <Typography className={className}>
    <Suspense fallback={<ContentPlaceholder />}>
      <SafeRenderer source={source} />
    </Suspense>
  </Typography>
)

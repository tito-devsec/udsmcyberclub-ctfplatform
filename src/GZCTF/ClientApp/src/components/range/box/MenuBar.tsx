import { FC, ReactNode, useEffect, useRef, useState } from 'react'
import classes from '@Styles/AttackBox.module.css'
import { Sym } from './icons'

export interface MenuAction {
  label: string
  // the keys that do the same, shown on the right as Kali's menus show them
  shortcut?: string
  // a grey icon on the left
  icon?: string
  disabled?: boolean
  checked?: boolean
  onSelect: () => void
}

export type MenuItem = MenuAction | 'separator'

export interface Menu {
  label: string
  items: MenuItem[]
}

// A menu's items, as a list that opens under its title or where the mouse was right-clicked.
const MenuList: FC<{ items: MenuItem[]; onDone: () => void; at?: { x: number; y: number } }> = ({
  items,
  onDone,
  at,
}) => (
  <div
    className={classes.menuList}
    role="menu"
    style={at ? { position: 'fixed', left: at.x, top: at.y } : undefined}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {items.map((item, index) =>
      item === 'separator' ? (
        <div key={`sep-${index}`} className={classes.menuSep} />
      ) : (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={classes.menuItem}
          disabled={item.disabled}
          onClick={() => {
            onDone()
            item.onSelect()
          }}
        >
          <span className={classes.menuIcon}>
            {item.checked ? '✓' : item.icon ? <Sym src={item.icon} size={14} /> : null}
          </span>
          <span className={classes.menuLabel}>{item.label}</span>
          <span className={classes.menuKey}>{item.shortcut}</span>
        </button>
      )
    )}
  </div>
)

// Closes a menu when the mouse goes down anywhere else, or Escape is pressed.
function useDismiss(open: boolean, close: () => void, root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', key, true)
    }
  }, [open, close, root])
}

// A window's menu bar, like Kali's programs have: a click opens a menu, and while one is open,
// moving to another title opens that one instead.
export const MenuBar: FC<{ menus: Menu[]; children?: ReactNode }> = ({ menus, children }) => {
  const [open, setOpen] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(open !== null, () => setOpen(null), root)

  return (
    <div ref={root} className={classes.menubar}>
      {menus.map((menu, index) => (
        <div key={menu.label} className={classes.menuRoot}>
          <button
            type="button"
            className={classes.menuTitle}
            data-open={open === index || undefined}
            onPointerDown={(event) => {
              event.stopPropagation()
              setOpen(open === index ? null : index)
            }}
            onPointerEnter={() => open !== null && setOpen(index)}
          >
            {menu.label}
          </button>
          {open === index && <MenuList items={menu.items} onDone={() => setOpen(null)} />}
        </div>
      ))}
      {children}
    </div>
  )
}

// The menu a right click opens.
export const ContextMenu: FC<{ at: { x: number; y: number } | null; items: MenuItem[]; onClose: () => void }> = ({
  at,
  items,
  onClose,
}) => {
  const root = useRef<HTMLDivElement>(null)
  useDismiss(Boolean(at), onClose, root)
  if (!at) return null
  return (
    <div ref={root}>
      <MenuList items={items} onDone={onClose} at={at} />
    </div>
  )
}

// A small question asked inside a window: a new name for a file, or a new folder's.
export const NamePrompt: FC<{
  title: string
  value: string
  confirm: string
  cancel: string
  onDone: (value: string | null) => void
}> = ({ title, value, confirm, cancel, onDone }) => {
  const [text, setText] = useState(value)
  return (
    <div className={classes.dialogShade} onPointerDown={(event) => event.stopPropagation()}>
      <form
        className={classes.dialog}
        onSubmit={(event) => {
          event.preventDefault()
          onDone(text.trim() || null)
        }}
      >
        <div className={classes.dialogTitle}>{title}</div>
        <input
          className={classes.input}
          value={text}
          autoFocus
          onFocus={(event) => {
            // select the name without its extension, as file managers do
            const dot = event.currentTarget.value.lastIndexOf('.')
            event.currentTarget.setSelectionRange(0, dot > 0 ? dot : event.currentTarget.value.length)
          }}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Escape' && onDone(null)}
        />
        <div className={classes.dialogButtons}>
          <button type="button" className={classes.button} onClick={() => onDone(null)}>
            {cancel}
          </button>
          <button type="submit" className={classes.button} data-tone="primary">
            {confirm}
          </button>
        </div>
      </form>
    </div>
  )
}

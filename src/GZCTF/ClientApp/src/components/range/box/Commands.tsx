import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '@Styles/AttackBox.module.css'

// Commands to start from, each aimed at the student's lab machine ("target"), as the box's own
// `tools` command lists them. The box has no internet, so these are what its tools can reach.
const COMMANDS: { key: string; command: string }[] = [
  { key: 'ports', command: 'target' },
  { key: 'services', command: 'nmap -sV target' },
  { key: 'whatweb', command: 'whatweb http://target' },
  { key: 'curl', command: 'curl -i http://target/' },
  { key: 'gobuster', command: 'gobuster dir -u http://target -w /usr/share/wordlists/dirb/common.txt' },
  { key: 'ffuf', command: 'ffuf -u http://target/FUZZ -w /usr/share/wordlists/dirb/common.txt' },
  { key: 'nikto', command: 'nikto -h http://target' },
  { key: 'sqlmap', command: "sqlmap -u 'http://target/item?id=1' --batch" },
  { key: 'hydra', command: 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://target' },
  { key: 'nc', command: 'nc target 9001' },
  { key: 'hashid', command: "hashid '<hash>'" },
  { key: 'john', command: 'john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt' },
  { key: 'hashcat', command: 'hashcat -m 0 hash.txt /usr/share/wordlists/rockyou.txt' },
  { key: 'binwalk', command: 'binwalk -e file.bin' },
  { key: 'exiftool', command: 'exiftool photo.jpg' },
  { key: 'steghide', command: 'steghide extract -sf photo.jpg' },
  { key: 'strings', command: 'strings program | less' },
  { key: 'checksec', command: 'pwn checksec ./program' },
  { key: 'tshark', command: 'tshark -r capture.pcap' },
  { key: 'serve', command: 'python3 -m http.server 8000' },
]

// The commands as a table in the Help window: a click copies one, to paste in the terminal.
export const BoxCommands: FC = () => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (command: string) =>
    navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(command)
        window.setTimeout(() => setCopied((now) => (now === command ? null : now)), 1500)
      },
      () => {}
    )

  return (
    <>
      <p className={classes.commandsHint}>{t('range.box.help.commands.hint')}</p>
      <table className={classes.commands}>
        <tbody>
          {COMMANDS.map(({ key, command }) => (
            <tr key={key}>
              <td>
                <button
                  type="button"
                  className={classes.command}
                  title={t('range.box.help.commands.copy')}
                  onClick={() => void copy(command)}
                >
                  {command}
                </button>
              </td>
              <td data-copied={copied === command || undefined}>
                {copied === command ? t('range.box.help.commands.copied') : t(`range.box.help.commands.${key}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

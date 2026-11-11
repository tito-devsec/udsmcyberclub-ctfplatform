import { Anchor, Button, PasswordInput, Select, TextInput } from '@mantine/core'
import { useInputState } from '@mantine/hooks'
import { showNotification, updateNotification } from '@mantine/notifications'
import { mdiCheck, mdiClose } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { AccountView } from '@Components/AccountView'
import { Captcha, useCaptchaRef } from '@Components/Captcha'
import { StrengthPasswordInput } from '@Components/StrengthPasswordInput'
import { encryptApiData } from '@Utils/Crypto'
import { rememberSkillLevel, SKILL_LEVELS, SkillLevel } from '@Utils/Range'
import { tryGetClientError } from '@Utils/Shared'
import { useConfig } from '@Hooks/useConfig'
import { usePageTitle } from '@Hooks/usePageTitle'
import api, { RegisterStatus } from '@Api'
import misc from '@Styles/Misc.module.css'

const Register: FC = () => {
  const [pwd, setPwd] = useInputState('')
  const [retypedPwd, setRetypedPwd] = useInputState('')
  const [uname, setUname] = useInputState('')
  const [email, setEmail] = useInputState('')
  const [level, setLevel] = useState<SkillLevel | null>(null)
  const [disabled, setDisabled] = useState(false)
  const { config } = useConfig()

  const navigate = useNavigate()
  const { captchaRef, getToken, cleanUp } = useCaptchaRef()

  const { t } = useTranslation()

  const RegisterStatusMap = new Map([
    [
      RegisterStatus.LoggedIn,
      {
        message: t('account.notification.register.logged_in'),
      },
    ],
    [
      RegisterStatus.AdminConfirmationRequired,
      {
        title: t('account.notification.register.request_sent.title'),
        message: t('account.notification.register.request_sent.message'),
      },
    ],
    [
      RegisterStatus.EmailConfirmationRequired,
      {
        title: t('common.email.sent.title'),
        message: t('common.email.sent.message'),
      },
    ],
    [undefined, undefined],
  ])

  usePageTitle(t('account.title.register'))

  const onRegister = async (event: React.SyntheticEvent) => {
    event.preventDefault()

    if (pwd !== retypedPwd) {
      showNotification({
        color: 'red',
        title: t('common.error.check_input'),
        message: t('account.password.not_match'),
        icon: <Icon path={mdiClose} size={1} />,
      })
      return
    }

    if (!level) {
      showNotification({
        color: 'red',
        title: t('common.error.check_input'),
        message: t('range.level.required'),
        icon: <Icon path={mdiClose} size={1} />,
      })
      return
    }

    const { valid, token } = await getToken()

    if (!valid) {
      showNotification({
        color: 'orange',
        title: t('account.notification.captcha.not_valid'),
        message: t('common.error.try_later'),
        loading: true,
      })
      return
    }

    setDisabled(true)

    showNotification({
      color: 'orange',
      id: 'register-status',
      title: t('account.notification.captcha.request_sent.title'),
      message: t('account.notification.captcha.request_sent.message'),
      loading: true,
      autoClose: false,
    })

    try {
      const res = await api.account.accountRegister({
        userName: uname,
        password: await encryptApiData(t, pwd, config.apiPublicKey),
        email: email,
        challenge: token,
      })
      const data = RegisterStatusMap.get(res.data.data)
      if (data) {
        // kept on this device and saved to the account once the student is signed in
        rememberSkillLevel(uname, level)
        updateNotification({
          id: 'register-status',
          color: 'teal',
          title: data.title,
          message: data.message,
          icon: <Icon path={mdiCheck} size={1} />,
          loading: false,
          autoClose: true,
        })
        cleanUp(true)

        if (res.data.data === RegisterStatus.LoggedIn) navigate('/')
        else if (res.data.data === RegisterStatus.EmailConfirmationRequired)
          navigate('/account/pending', { state: { email } })
        else navigate('/account/login')
      }
    } catch (err: any) {
      const { title, message } = tryGetClientError(err, t)

      updateNotification({
        id: 'register-status',
        color: 'red',
        title,
        message,
        icon: <Icon path={mdiClose} size={1} />,
        loading: false,
        autoClose: true,
      })
      cleanUp(false)
    } finally {
      setDisabled(false)
    }
  }

  return (
    <AccountView onSubmit={onRegister}>
      <TextInput
        required
        label={t('account.label.email')}
        type="email"
        placeholder="ctf@example.com"
        w="100%"
        value={email}
        disabled={disabled}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      <TextInput
        required
        label={t('account.label.username')}
        type="text"
        placeholder="ctfer"
        w="100%"
        value={uname}
        disabled={disabled}
        onChange={(event) => setUname(event.currentTarget.value)}
      />
      <Select
        required
        allowDeselect={false}
        w="100%"
        label={t('range.level.label')}
        placeholder={t('range.level.choose')}
        data={SKILL_LEVELS.map((value) => ({ value, label: t(`range.level.${value}`) }))}
        value={level}
        onChange={(value) => setLevel(value as SkillLevel | null)}
        disabled={disabled}
      />
      <StrengthPasswordInput value={pwd} onChange={(event) => setPwd(event.currentTarget.value)} disabled={disabled} />
      <PasswordInput
        required
        label={t('account.label.password_retype')}
        value={retypedPwd}
        onChange={(event) => setRetypedPwd(event.currentTarget.value)}
        disabled={disabled}
        w="100%"
        error={pwd !== retypedPwd}
      />
      <Captcha action="register" ref={captchaRef} />
      <Anchor fz="xs" className={misc.alignSelfEnd} component={Link} to="/account/login">
        {t('account.anchor.login')}
      </Anchor>
      <Button type="submit" fullWidth onClick={onRegister} disabled={disabled}>
        {t('account.button.register')}
      </Button>
    </AccountView>
  )
}

export default Register

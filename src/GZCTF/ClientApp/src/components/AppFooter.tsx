import { Center, Divider, Stack, Text } from '@mantine/core'
import { FC } from 'react'
import { Copyright } from '@Components/Copyright'
import { FooterRender } from '@Components/FooterRender'
import { LogoBox } from '@Components/LogoBox'
import { useIsMobile } from '@Utils/ThemeOverride'
import { useIsCtfRoute } from '@Hooks/useBrand'
import { useConfig } from '@Hooks/useConfig'
import classes from '@Styles/AppFooter.module.css'
import logoClasses from '@Styles/LogoHeader.module.css'

export const AppFooter: FC = () => {
  const { config } = useConfig()
  const isMobile = useIsMobile()
  const ctf = useIsCtfRoute()

  return (
    <>
      <div className={classes.spacer} />
      <div className={classes.wrapper}>
        <Center mx="auto" h="100%">
          <Stack gap="sm" w={isMobile ? '100%' : '80%'}>
            <Stack w="100%" align="center" gap={2}>
              <LogoBox size={isMobile ? '3rem' : '4rem'} />
              <Text fw="bold" size={isMobile ? '2rem' : '2.5rem'}>
                {ctf ? (
                  <>
                    UD<span className={logoClasses.brand}>::</span>CTF
                  </>
                ) : (
                  <>
                    UDSM Cyber<span className={logoClasses.brand}>Range</span>
                  </>
                )}
              </Text>
            </Stack>
            {isMobile ? (
              <>
                <Copyright isMobile={isMobile} />
                {config.footerInfo && <Divider />}
              </>
            ) : (
              <Divider label={<Copyright isMobile={isMobile} />} labelPosition="center" />
            )}
            {config.footerInfo && <FooterRender source={config.footerInfo} />}
          </Stack>
        </Center>
      </div>
    </>
  )
}

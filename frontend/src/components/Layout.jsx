import { AppShell, Burger, Group, NavLink as MantineNavLink, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV_ITEMS, ROUTES } from '../routes.js'
import classes from './Layout.module.css'

export const HEADER_HEIGHT = 60

export default function Layout() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const { pathname } = useLocation()

  // Full-screen pages: fill the area below the header, no padding, no page scroll
  // (Mission Control = 3D scene, Presentation = its own scrolling sections).
  const isFullBleed = pathname === ROUTES.missionControl.path || pathname === ROUTES.presentation.path
  // Edge-to-edge pages that still scroll normally (Home has a full-width hero image).
  const noPadding = isFullBleed || pathname === ROUTES.home.path

  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { desktop: true, mobile: !opened } }}
      padding={noPadding ? 0 : 'md'}
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="md" justify="space-between">
          <UnstyledButton component={NavLink} to={ROUTES.home.path} onClick={close}>
            <Group gap={8}>
              <span className={classes.logoDot} />
              <Text fw={800} size="lg" lts={0.5}>
                MISSION CONTROL
              </Text>
            </Group>
          </UnstyledButton>

          <Group gap={4} visibleFrom="sm">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={({ isActive }) => (isActive ? `${classes.link} ${classes.active}` : classes.link)}
              >
                {item.label}
              </NavLink>
            ))}
          </Group>

          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
        </Group>
      </AppShell.Header>

      {/* Mobile drawer nav */}
      <AppShell.Navbar p="md">
        <Stack gap={4}>
          {NAV_ITEMS.map((item) => (
            <MantineNavLink
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              active={pathname === item.path}
              onClick={close}
            />
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className={isFullBleed ? classes.fullBleed : undefined}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

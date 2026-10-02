import { AppShell, Burger, Group, NavLink as MantineNavLink, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV_ITEMS, ROUTES } from '../routes.js'
import classes from './Layout.module.css'

export const HEADER_HEIGHT = 60

export default function Layout() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const { pathname } = useLocation()

  // The 3D page gets the full area below the header with no padding.
  const isFullBleed = pathname === ROUTES.missionControl.path

  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { desktop: true, mobile: !opened } }}
      padding={isFullBleed ? 0 : 'md'}
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

import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'
import Globe from 'globe.gl'
import * as THREE from 'three'
import moonSurface from '../../assets/moonSurface.jpg'
import sunSurface from '../../assets/sunSurface.jpg'
import { ISS, LAUNCH_SITES } from './launchConfig.js'
import { DEFAULT_TIME_SCALE } from './simConfig.js'
import { EARTH_R, ALT_SCALE, altFrac, orbitPoints, getAscent } from './orbitMath.js'
import {
  makeIssObject,
  makeLaunchSiteModel,
  makeStarField,
  orbitShell,
  makePoints,
} from './models3d.js'
import { startLaunchSimulation } from './launchSimulation.js'
import { boosterPath, boosterLandingPoint, landingTypeOf } from './boosterPath.js'

const DEBRIS_RADIUS_KM = 10

/* ── ISS: live position + ground track from wheretheiss.at ── */
const ISS_API =
  `https://api.wheretheiss.at/v1/satellites/${ISS.noradId}`

const ISS_POSITION_EVERY_MS = 15000
const ISS_TRACK_EVERY_MS = 5 * 60 * 1000

async function fetchIssPosition() {
  const res = await fetch(ISS_API)

  if (!res.ok) {
    throw new Error(`ISS position ${res.status}`)
  }

  return res.json()
}

async function fetchIssTrack() {
  const now = Math.floor(Date.now() / 1000)

  const stamps = Array.from(
    { length: 20 },
    (_, index) => now + (index - 10) * 300
  )

  const get = async (ts) => {
    const res = await fetch(
      `${ISS_API}/positions?timestamps=${ts.join(',')}&units=kilometers`
    )

    if (!res.ok) {
      throw new Error(`ISS track ${res.status}`)
    }

    return res.json()
  }

  const first = await get(stamps.slice(0, 10))

  await new Promise((resolve) => setTimeout(resolve, 1100))

  const second = await get(stamps.slice(10))

  return [...first, ...second].map((issPoint) => ({
    lat: issPoint.latitude,
    lng: issPoint.longitude,
    alt: altFrac(issPoint.altitude),
  }))
}


export default function SceneViewport({
  mission,
  windows,
  selectedId,
  onSelect,
  trajectory,
  shellsVisible = {
    leo: false,
    polar: false,
    sso: false,
    debris: true,
  },
  draftParams,
  onTargetBaseChange,
  onLaunchSiteClick,
  onIssClick,
  simulation,
  timeScale = DEFAULT_TIME_SCALE,
  playing = true,
  simClock, // shared { simMs, follow } (pages/MissionControl.jsx): read by the timeline
}) {
  const containerRef = useRef(null)
  const globeRef = useRef(null)
  const globeInstance = useRef(null)

  const shellMeshes = useRef({})

  const [size, setSize] =
    useState({
      width: 0,
      height: 0,
    })

  const [targetBase, setTargetBase] =
    useState(null)

  const [debris, setDebris] =
    useState(null)

  const [entry, setEntry] =
    useState(null)

  // null | {status:'checking'} | {status:'error', message} | {status:'done', ...result}
  const [collision, setCollision] =
    useState(null)

  const onLaunchSiteClickRef =
    useRef(onLaunchSiteClick)

  onLaunchSiteClickRef.current =
    onLaunchSiteClick

  const onTargetBaseChangeRef =
    useRef(onTargetBaseChange)

  onTargetBaseChangeRef.current =
    onTargetBaseChange

  const onIssClickRef =
    useRef(onIssClick)

  onIssClickRef.current =
    onIssClick

  // Site the camera last flew to.
  const lastViewedSiteRef =
    useRef(null)

  const missionLayers =
    useRef({
      paths: [],
      objects: [],
    })

  const issData =
    useRef({
      position: null,
      track: [],
    })

  const applyLayers = () => {
    const globe =
      globeInstance.current

    if (!globe) return

    const {
      position: livePosition,
      track: liveTrack,
    } = issData.current

    // ISS toggle: when hidden, keep polling but draw nothing
    const issOn = shellsVisibleRef.current?.iss ?? true
    const position = issOn ? livePosition : null
    const track = issOn ? liveTrack : []
    const issPaths =
      track.length > 1
        ? [
            {
              name: 'ISS orbit (past)',

              pts: position
                ? [
                    ...track.slice(0, 11),
                    {
                      lat: position.latitude,
                      lng: position.longitude,
                      alt: altFrac(
                        position.altitude
                      ),
                    },
                  ]
                : track.slice(0, 11),

              color: [
                'rgba(0, 200, 255, 0.05)',
                'rgba(0, 200, 255, 0.9)',
              ],

              stroke: 1.4,
            },

            {
              name: 'ISS orbit (ahead)',

              pts: position
                ? [
                    {
                      lat: position.latitude,
                      lng: position.longitude,
                      alt: altFrac(
                        position.altitude
                      ),
                    },
                    ...track.slice(10),
                  ]
                : track.slice(10),

              color: [
                '#7ff3ff',
                'rgba(127, 243, 255, 0.35)',
              ],

              stroke: 1.8,
              dashLength: 0.04,
              dashGap: 0.02,
              dashAnimateTime: 12000,
            },
          ]
        : []

    const issObjects =
      position
        ? [
            {
              id: ISS.id,
              type: 'iss',
              name:
                `${ISS.name} · ` +
                `${Math.round(
                  position.altitude
                )} km up · ` +
                `${Math.round(
                  position.velocity
                ).toLocaleString()} km/h ` +
                `(click for live video)`,

              lat: position.latitude,
              lng: position.longitude,
              alt: altFrac(
                position.altitude
              ),
            },
          ]
        : []

    globe.pathsData([
      ...missionLayers.current.paths,
      ...issPaths,
    ])

    globe.objectsData([
      ...missionLayers.current.objects,
      ...issObjects,
    ])
  }

  /*
   * Everything needed by the launch animation.
   */
  const flightRef = useRef({
    ascent: [],
    endTheta: 0,
    altKm: 0,
    inclinationDeg: 0,
    raanDeg: 0,
  })

  const shellsVisibleRef =
    useRef(shellsVisible)

  const playingRef = useRef(playing)
  playingRef.current = playing

  const timeScaleRef =
    useRef(timeScale)

  useEffect(() => {
    timeScaleRef.current =
      timeScale
  }, [timeScale])

  const siteId =
    draftParams?.siteId ??
    mission?.launchSite?.id ??
    LAUNCH_SITES[0].id

  const targetInclination =
    Number(
      draftParams?.inclinationDeg ??
      mission?.inclinationDeg ??
      0
    )

  const targetAltitude =
    Number(
      draftParams?.altitudeKm ??
      mission?.altitudeKm ??
      0
    )

  const ascentAzimuth =
    Number(mission?.azimuthDeg)

  // Any change to the Mission Inputs changes this key
  const draftKey = JSON.stringify([
    draftParams?.siteId,
    draftParams?.orbit,
    Number(draftParams?.inclinationDeg),
    Number(draftParams?.altitudeKm),
    Number(draftParams?.days),
  ])

  // The inputs the current `mission` was calculated with (recorded when a result arrives).
  // While the inputs differ from this, the path / orbit / model are reset and hidden.
  const missionDraftKeyRef = useRef(null)
  useEffect(() => {
    missionDraftKeyRef.current = mission ? draftKey : null
  }, [mission]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track container size.
  useEffect(() => {
    const el =
      containerRef.current

    if (!el) return

    const observer =
      new ResizeObserver(
        ([entry]) => {
          const {
            width,
            height,
          } = entry.contentRect

          setSize({
            width: Math.round(width),
            height: Math.round(height),
          })
        }
      )

    observer.observe(el)

    return () =>
      observer.disconnect()
  }, [])

  // Create globe.
  useEffect(() => {
    const el =
      globeRef.current

    if (!el) return

    const globe =
      Globe()(el)
        .globeImageUrl(
          'https://i2.wp.com/eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.topo.200412.3x5400x2700.jpg?ssl=1'
        )
        .backgroundColor(
          'rgba(0,0,0,0)'
        )

    globeInstance.current =
      globe

    const earthRadius =
      globe.getGlobeRadius()

    const moonDistance =
      earthRadius * 3.2

    const sunDistance =
      earthRadius * 18

    const sunRadius =
      earthRadius * 0.45

    const moonRadius =
      earthRadius * 0.12

    const makeGlowSprite = ({
      color,
      opacity,
      size,
    }) => {
      const canvas =
        document.createElement(
          'canvas'
        )

      canvas.width = 256
      canvas.height = 256

      const ctx =
        canvas.getContext('2d')

      const gradient =
        ctx.createRadialGradient(
          128,
          128,
          12,
          128,
          128,
          128
        )

      gradient.addColorStop(
        0,
        color
      )

      gradient.addColorStop(
        0.25,
        color
      )

      gradient.addColorStop(
        0.55,
        'rgba(255,255,255,0.18)'
      )

      gradient.addColorStop(
        1,
        'rgba(0,0,0,0)'
      )

      ctx.fillStyle = gradient
      ctx.fillRect(
        0,
        0,
        256,
        256
      )

      const texture =
        new THREE.CanvasTexture(
          canvas
        )

      const material =
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity,
          depthWrite: false,
          blending:
            THREE.AdditiveBlending,
        })

      const sprite =
        new THREE.Sprite(material)

      sprite.scale.set(
        size,
        size,
        1
      )

      return sprite
    }

    const textureLoader =
      new THREE.TextureLoader()

    const moonTexture =
      textureLoader.load(
        moonSurface
      )

    const sunTexture =
      textureLoader.load(
        sunSurface
      )

    const sun =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          sunRadius,
          32,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: '#ffb347',
          map: sunTexture,
        })
      )

    sun.position.set(
      -sunDistance,
      0,
      0
    )

    const sunGlow =
      makeGlowSprite({
        color:
          'rgba(255, 185, 71, 0.95)',
        opacity: 0.9,
        size:
          sunRadius * 10,
      })

    sun.add(sunGlow)

    const moon =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          moonRadius,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: '#d7dce6',
          map: moonTexture,
        })
      )

    moon.position.set(
      moonDistance,
      0,
      0
    )

    const moonGlow =
      makeGlowSprite({
        color:
          'rgba(180, 195, 215, 0.7)',
        opacity: 0.35,
        size:
          moonRadius * 12,
      })

    moon.add(moonGlow)

    globe.scene().add(sun)
    globe.scene().add(moon)

    const stars =
      makeStarField(
        earthRadius * 30
      )

    globe.scene().add(stars)

    const camera =
      globe.camera()

    if (
      camera.far <
      earthRadius * 45
    ) {
      camera.far =
        earthRadius * 45

      camera.updateProjectionMatrix()
    }

    shellMeshes.current = {
      leo: orbitShell(globe, {
        altMinKm: 160,
        altMaxKm: 2000,
        maxLatDeg: 90,
        color: '#49ff5e',
        opacity: 0.08,
        renderOrder: 1,
      }),

      polar: orbitShell(globe, {
        altMinKm: 200,
        altMaxKm: 1000,
        maxLatDeg: 90,
        color: '#ffb74d',
        opacity: 0.15,
        renderOrder: 2,
      }),

      sso: orbitShell(globe, {
        altMinKm: 600,
        altMaxKm: 800,
        maxLatDeg: 82,
        color: '#4fc3f7',
        opacity: 0.25,
        renderOrder: 3,
      }),
    }

    Object.entries(
      shellMeshes.current
    ).forEach(
      ([name, mesh]) => {
        mesh.visible =
          shellsVisibleRef
            .current[name] ??
          false
      }
    )

    return () => {
      globe.pathsData([])
      globe.pointsData([])
      globe.objectsData([])

      Object.values(
        shellMeshes.current
      ).forEach((shellGroup) => {
        globe.scene().remove(shellGroup)

        shellGroup.traverse((part) => {
          part.geometry?.dispose()
          part.material?.dispose()
        })
      })

      globe._destructor()

      el.innerHTML = ''

      globeInstance.current =
        null
    }
  }, [])

  // Resize globe.
  useEffect(() => {
    const globe =
      globeInstance.current

    if (
      globe &&
      size.width &&
      size.height
    ) {
      globe
        .width(size.width)
        .height(size.height)
    }
  }, [size])

  // Shell visibility.
  useEffect(() => {
    shellsVisibleRef.current =
      shellsVisible

    Object.entries(
      shellsVisible
    ).forEach(
      ([name, visible]) => {
        if (
          shellMeshes.current[name]
        ) {
          shellMeshes.current[
            name
          ].visible = visible
        }
      }
    )
  }, [shellsVisible])

  // ISS toggle: redraw the ISS layers right away (no camera move)
  useEffect(() => {
    applyLayers()
  }, [shellsVisible.iss])

  // Static drawing: ascent path, target orbit, launch-site markers.
  // Depends only on the site and target orbit, never on the selected launch window.
  useEffect(() => {
    const globe = globeInstance.current
    if (!globe) return

    const activeTargetBase =
      (
        draftParams?.siteId &&
        LAUNCH_SITES.find(
          (site) =>
            site.id ===
            draftParams.siteId
        )
      ) ||
      targetBase ||
      mission?.launchSite ||
      LAUNCH_SITES[0]

    // Launch sites are always drawn as miniature 3D models (objects layer),
    // whether or not a mission has been calculated
    const siteModels = LAUNCH_SITES.map((launchSite) => ({
      id: launchSite.id,
      type: 'site',
      name: `${launchSite.name} (click to select)`,
      lat: launchSite.lat,
      lng: launchSite.lon,
      alt: 0.001,
      active: launchSite.id === activeTargetBase.id,
    }))

    const selectSite = (siteIdClicked) => {
      const clickedSite = LAUNCH_SITES.find(site => site.id === siteIdClicked)
      if (!clickedSite) return
      setTargetBase(clickedSite)
      onTargetBaseChangeRef.current?.(clickedSite)
      onLaunchSiteClickRef.current?.(clickedSite)
      // Fly there now, and remember it so the camera effect doesn't fly there again
      lastViewedSiteRef.current = clickedSite.id
      globe.pointOfView({ lat: clickedSite.lat, lng: clickedSite.lon }, 2000)
    }

    globe
      .objectLat(item => item.lat)
      .objectLng(item => item.lng)
      .objectAltitude(item => item.alt)
      .objectLabel(item => item.name)
      .objectThreeObject(item =>
        item.type === 'iss'
          ? makeIssObject()
          : item.type === 'site'
            ? makeLaunchSiteModel({ siteId: item.id, active: item.active })
            : new THREE.Mesh(
                new THREE.SphereGeometry(1, 16, 16),
                new THREE.MeshBasicMaterial({ color: item.color })
              )
      )
      .onObjectClick((obj) => {
        if (obj?.type === 'iss') onIssClickRef.current?.()
        if (obj?.type === 'site') selectSite(obj.id)
      })
      .onObjectHover((obj) => {
        if (globeRef.current) globeRef.current.style.cursor = obj?.type === 'iss' || obj?.type === 'site' ? 'pointer' : ''
      })

    // RESET: draw no ascent path, target orbit or entry point unless there's a calculated
    // mission AND the Mission Inputs still match what it was calculated with.
    // (Any change to the inputs also stops the simulation; see pages/MissionControl.jsx.)
    const stale = !mission || missionDraftKeyRef.current !== draftKey
    if (
      stale ||
      !Number.isFinite(targetAltitude) ||
      targetAltitude <= 0 ||
      !Number.isFinite(targetInclination) ||
      !Number.isFinite(ascentAzimuth)
    ) {
      flightRef.current = { siteId: null, ascent: [], endTheta: 0, launchTheta: 0, altKm: 0, inclinationDeg: 0, raanDeg: 0 }
      setEntry(null)
      globe.pointsData([])
      missionLayers.current = { paths: [], objects: siteModels }
      applyLayers()
      return
    }

    const {
      ascent,
      endTheta,
      raanDeg,
      inclinationDeg,
      launchTheta,
    } =
      getAscent(
        activeTargetBase,
        targetInclination,
        targetAltitude,
        ascentAzimuth
      )

    if (
      !ascent ||
      ascent.length < 2
    ) {
      return
    }

    /*
     * Save all geometry needed by the animation.
     */
    flightRef.current = {
      siteId: activeTargetBase.id,
      ascent,
      endTheta,
      launchTheta,
      raanDeg,
      altKm:
        targetAltitude,
      inclinationDeg,
    }

    // Booster return path: back to the landing zone, out to the drone ship,
    // or a short fall (sites that don't recover boosters)
    const launchSiteConfig = LAUNCH_SITES.find((candidate) => candidate.id === activeTargetBase.id)
    const boosterReturn = launchSiteConfig
      ? boosterPath(flightRef.current, launchSiteConfig)
      : []
    const boosterLanding = launchSiteConfig
      ? boosterLandingPoint(flightRef.current, launchSiteConfig)
      : null

    const orbits = []

    if (
      targetAltitude > 0 &&
      inclinationDeg > 0
    ) {
      orbits.push({
        pts: orbitPoints({
          altKm:
            targetAltitude,

          inclinationDeg,

          raanDeg,
        }),

        color: 'red',
        stroke: 1,
      })
    }

    const paths = [
      {
        name: 'Ascent Path',
        pts: ascent,
        color: 'red',
        stroke: 2,
      },

      ...orbits,

      ...(boosterReturn.length > 1
        ? [{
            name: boosterLanding?.type === 'pad'
              ? `Booster return to ${boosterLanding.name}`
              : boosterLanding?.type === 'ship'
                ? 'Booster to drone ship'
                : 'Booster fall (not recovered)',
            pts: boosterReturn,
            color: landingTypeOf(launchSiteConfig) ? '#4fc3f7' : 'rgba(255,255,255,0.35)',
            stroke: 1.2,
            dashLength: 0.02,
            dashGap: 0.015,
          }]
        : []),
    ]

    globe
      .pointsData([])
      .pathPoints(
        path => path.pts
      )
      .pathPointLat(
        point => point.lat
      )
      .pathPointLng(
        point => point.lng
      )
      .pathPointAlt(
        point => point.alt
      )
      .pathColor(
        path => path.color
      )
      .pathStroke(
        path => path.stroke
      )
      .pathDashLength(
        path =>
          path.dashLength ?? 1
      )
      .pathDashGap(
        path =>
          path.dashGap ?? 0
      )
      .pathDashAnimateTime(
        path =>
          path.dashAnimateTime ?? 0
      )
      .pathTransitionDuration(0)
      .pathResolution(1)

    const markers = []

    const last =
      ascent[
        ascent.length - 1
      ]

    /*
     * Point where the ascent reaches the target altitude.
     */
    setEntry({
      lat: last.lat,
      lon: last.lng,
      altKm:
        targetAltitude,
    })

    // (The green sphere below marks this point. A globe.gl "point" here would draw a
    // column from the ground all the way up to orbit.)

    /*
     * Green intersection point:
     *
     * This is exactly where the ascent meets the target
     * orbital altitude.
     */
    const intersectionPoint = {
      id:
        'intersection-point',

      type:
        'intersection',

      name:
        `${last.lat.toFixed(2)}°, ` +
        `lon: ${last.lng.toFixed(2)}°, ` +
        `alt: ${targetAltitude} km`,

      lat: last.lat,
      lng: last.lng,
      alt: last.alt,
      color: '#2fe36b',
    }

    globe
      .pointsData(markers)
      .pointLat(
        marker => marker.lat
      )
      .pointLng(
        marker => marker.lng
      )
      .pointAltitude(
        marker => marker.alt
      )
      .pointLabel(
        marker => marker.name
      )
      .pointRadius(
        marker =>
          marker.type ===
          'launchsite-interactive'
            ? 1.5
            : marker.type ===
              'launchsite-selected'
              ? 1.0
              : 0.5
      )
      .pointColor(
        marker => marker.color
      )
      .onPointClick(
        (
          point,
          event,
          coords
        ) => {
          if (
            !coords ||
            !point?.type?.startsWith(
              'launchsite'
            )
          ) {
            return
          }

          const clickedSite =
            LAUNCH_SITES.find(
              site =>
                site.id ===
                point.id
            )

          if (!clickedSite) {
            return
          }

          setTargetBase(
            clickedSite
          )

          onTargetBaseChangeRef
            .current?.(
              clickedSite
            )

          onLaunchSiteClickRef
            .current?.(
              clickedSite
            )

          lastViewedSiteRef.current =
            clickedSite.id

          globe.pointOfView(
            {
              lat:
                clickedSite.lat,
              lng:
                clickedSite.lon,
            },
            2000
          )
        }
      )
      .onPointHover(
        (point) => {
          if (
            globeRef.current
          ) {
            globeRef.current.style.cursor =
              point?.type?.startsWith(
                'launchsite'
              )
                ? 'pointer'
                : ''
          }
        }
      )
      .objectLat(
        item => item.lat
      )
      .objectLng(
        item => item.lng
      )
      .objectAltitude(
        item => item.alt
      )
      .objectLabel(
        item => item.name
      )
      .objectThreeObject(
        item =>
          new THREE.Mesh(
            new THREE.SphereGeometry(
              1,
              16,
              16
            ),
            new THREE.MeshBasicMaterial(
              {
                color:
                  item.color,
              }
            )
          )
      )

    missionLayers.current = { paths, objects: [intersectionPoint, ...siteModels] }
    globe
      .objectThreeObject(item =>
        item.type === 'iss'
          ? makeIssObject()
          : item.type === 'site'
            ? makeLaunchSiteModel({ siteId: item.id, active: item.active })
            : new THREE.Mesh(
                new THREE.SphereGeometry(1, 16, 16),
                new THREE.MeshBasicMaterial({ color: item.color })
              )
      )
      .onObjectClick((obj) => {
        if (obj?.type === 'iss') onIssClickRef.current?.()
        if (obj?.type === 'site') selectSite(obj.id)
      })
      .onObjectHover((obj) => {
        if (globeRef.current) globeRef.current.style.cursor = obj?.type === 'iss' || obj?.type === 'site' ? 'pointer' : ''
      })

    applyLayers()
  }, [
    siteId,
    targetInclination,
    targetAltitude,
    ascentAzimuth,
    draftParams?.siteId,
    targetBase,
    mission,
    draftKey,
  ])

  // Camera: only moves when launch site changes.
  useEffect(() => {
    const globe =
      globeInstance.current

    const site =
      LAUNCH_SITES.find(
        site => site.id === siteId
      )

    if (!globe || !site) {
      return
    }

    if (
      lastViewedSiteRef.current ===
      site.id
    ) {
      return
    }

    lastViewedSiteRef.current =
      site.id

    globe.pointOfView(
      {
        lat: site.lat,
        lng: site.lon,
      },
      2000
    )
  }, [siteId])

  /*
   * Launch animation (see launchSimulation.js): stages, booster recovery, satellite
   * release, trails and the chase camera. Runs while `simulation` is set; the shared
   * `simClock` lets the timeline pause, change speed and jump around.
   */
  useEffect(() => {
    const globe = globeInstance.current
    const flight = flightRef.current
    const site = LAUNCH_SITES.find((candidate) => candidate.id === flight.siteId)
    if (!globe || !simulation || !site || !flight.ascent || flight.ascent.length < 2) return

    simClock.simMs = 0
    simClock.follow = 'rocket'
    return startLaunchSimulation({
      globe,
      viewEl: globeRef.current,
      flight,
      site,
      clock: simClock,
      getTimeScale: () => timeScaleRef.current,
      isPlaying: () => playingRef.current,
    })
  }, [simulation]) // eslint-disable-line react-hooks/exhaustive-deps

  // When Simulate is pressed, check the ascent path against the debris catalog
  useEffect(() => {
    if (!simulation) {
      setCollision(null)
      return
    }
    const ascent = flightRef.current.ascent
    if (!ascent || ascent.length < 2) return

    const win = windows?.find(launchWindow => launchWindow.id === selectedId) ?? windows?.[0]
    const start = win ? new Date(win.opensAt) : new Date()

    // ascent points store altitude as a fraction of Earth's radius, so convert back to km
    const points = ascent.map((point) => ({
      t_sec: point.tSec,
      lat: point.lat,
      lon: point.lng,
      alt_km: (point.alt / ALT_SCALE) * EARTH_R,
    }))

    const ctrl = new AbortController()
    setCollision({ status: 'checking' })
    fetch('/api/debris/path-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: start.toISOString(), points, radius_km: DEBRIS_RADIUS_KM }),
      signal: ctrl.signal,
    })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(`path check failed: ${response.status}`))))
      .then(data => setCollision({ status: 'done', ...data }))
      .catch(err => {
        if (err.name !== 'AbortError') setCollision({ status: 'error', message: err.message })
      })

    return () => ctrl.abort()
  }, [simulation])

  // ISS: poll live position and refresh orbit track.
  useEffect(() => {
    let cancelled = false

    const updatePosition =
      () =>
        fetchIssPosition()
          .then((position) => {
            if (cancelled) {
              return
            }

            issData.current.position =
              position

            applyLayers()
          })
          .catch((error) =>
            console.warn(
              'ISS position unavailable:',
              error.message
            )
          )

    const updateTrack =
      () =>
        fetchIssTrack()
          .then((track) => {
            if (cancelled) {
              return
            }

            issData.current.track =
              track

            applyLayers()
          })
          .catch((error) =>
            console.warn(
              'ISS track unavailable:',
              error.message
            )
          )

    updatePosition()

    const trackDelay =
      setTimeout(
        updateTrack,
        1200
      )

    const positionTimer =
      setInterval(
        updatePosition,
        ISS_POSITION_EVERY_MS
      )

    const trackTimer =
      setInterval(
        updateTrack,
        ISS_TRACK_EVERY_MS
      )

    return () => {
      cancelled = true

      clearTimeout(
        trackDelay
      )

      clearInterval(
        positionTimer
      )

      clearInterval(
        trackTimer
      )
    }
  }, [])

  // Ask backend what debris is near entry point.
  useEffect(() => {
    if (!entry) {
      return
    }

    const win =
      windows?.find(
        launchWindow => launchWindow.id === selectedId
      ) ??
      windows?.[0]

    const base =
      win
        ? new Date(
            win.opensAt
          ).getTime()
        : Date.now()

    const when =
      new Date(
        base +
          600 * 1000
      )

    const ctrl =
      new AbortController()

    const qs =
      new URLSearchParams({
        lat: entry.lat,
        lon: entry.lon,
        alt_km: entry.altKm,
        time:
          when.toISOString(),
        radius_km:
          DEBRIS_RADIUS_KM,
      })

    console.log(
      'requesting debris check:',
      Object.fromEntries(qs)
    )

    fetch(
      `/api/debris?${qs}`,
      {
        signal:
          ctrl.signal,
      }
    )
      .then(response =>
        response.ok
          ? response.json()
          : Promise.reject(
              new Error(
                `debris request failed: ${response.status}`
              )
            )
      )
      .then(data => {
        setDebris(data)

        console.log(
          'debris check:',
          data.clear
            ? 'CLEAR'
            : `${data.nearby.length} nearby`,
          'cloud size:',
          data.cloud.length
        )
      })
      .catch(err => {
        if (
          err.name !==
          'AbortError'
        ) {
          console.warn(err)
        }
      })

    return () =>
      ctrl.abort()
  }, [
    entry?.lat,
    entry?.lon,
    entry?.altKm,
    windows,
    selectedId,
  ])

  // Draw debris as tiny points.
  useEffect(() => {
    const globe =
      globeInstance.current

    const debrisOn =
      shellsVisible.debris ??
      true

    if (
      !globe ||
      !debris ||
      !debrisOn
    ) {
      return
    }

    const scene =
      globe.scene()

    const group =
      new THREE.Group()

    const cloud =
      debris.cloud.filter(
        ([
          ,
          ,
          altKm,
        ]) =>
          altKm > 100
      )

    group.add(
      makePoints(
        globe,
        cloud,
        {
          size: 0.9,
          color: '#ff8a80',
          opacity: 0.9,
        }
      )
    )

    if (
      debris.nearby.length
    ) {
      const near =
        debris.nearby.map(
          debrisObject => [
            debrisObject.lat,
            debrisObject.lon,
            debrisObject.alt_km,
          ]
        )

      group.add(
        makePoints(
          globe,
          near,
          {
            size: 2.5,
            color: '#ff1744',
            opacity: 1,
          }
        )
      )
    }

    scene.add(group)

    return () => {
      scene.remove(group)

      group.traverse(
        part => {
          part.geometry?.dispose()
          part.material?.dispose()
        }
      )
    }
  }, [
    debris,
    shellsVisible.debris,
  ])

  // Status banner for the Simulate debris check
  const banner = (() => {
    if (!collision) return null
    if (collision.status === 'checking') return { color: '#90a4ae', text: 'Checking ascent path for debris…' }
    if (collision.status === 'error') return { color: '#ffb74d', text: 'Debris check unavailable', detail: collision.message }
    const closest = collision.closest
    const detail = closest ? `Closest: ${closest.name} · ${closest.distance_km} km at T+${Math.round(closest.t_sec)} s` : ''
    return collision.clear
      ? { color: '#4caf50', text: `Clear: nothing within ${collision.radius_km} km of the ascent path`, detail }
      : { color: '#ff1744', text: `Warning: ${collision.conflict_count} object(s) within ${collision.radius_km} km`, detail }
  })()

  return (
    <div
      ref={containerRef}
      className={classes.viewport}
    >
      <div
        ref={globeRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
      {banner && (
        <div
          style={{
            position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
            padding: '8px 14px', borderRadius: 8, background: 'rgba(10,12,20,0.88)',
            border: `1px solid ${banner.color}`, color: '#fff', fontSize: 13,
            textAlign: 'center', pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, color: banner.color }}>{banner.text}</div>
          {banner.detail && <div style={{ opacity: 0.8, fontSize: 12 }}>{banner.detail}</div>}
        </div>
      )}
    </div>
  )
}
import json, math, time
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import requests
from sgp4 import omm
from sgp4.api import Satrec, SatrecArray, jday

URL = "https://celestrak.org/NORAD/elements/gp.php"
QUERIES = [{"NAME": "DEB"}]          # or [{"GROUP": "cosmos-2251-debris"}, ...]
CACHE = Path(__file__).parent / "debris_cache.json"
MAX_AGE_S = 3 * 3600                 # don't hit CelesTrak more often than this

_state = {"sats": None, "meta": None, "loaded_at": 0}


def _load_records():
    fresh = CACHE.exists() and time.time() - CACHE.stat().st_mtime < MAX_AGE_S
    if not fresh:
        try:
            records = []
            for q in QUERIES:
                r = requests.get(URL, params={**q, "FORMAT": "JSON"}, timeout=30)
                r.raise_for_status()
                records += r.json()
            CACHE.write_text(json.dumps(records))
        except Exception:
            if not CACHE.exists():
                raise                # nothing cached either, so fail loudly
    return json.loads(CACHE.read_text())


def _get_sats():
    if _state["sats"] is None or time.time() - _state["loaded_at"] > MAX_AGE_S:
        sats, meta = [], []
        for fields in _load_records():
            try:
                s = Satrec()
                omm.initialize(s, fields)
                sats.append(s)
                meta.append((fields["OBJECT_NAME"], fields["NORAD_CAT_ID"]))
            except Exception:
                continue
        _state.update(sats=SatrecArray(sats), meta=meta, loaded_at=time.time())
    return _state["sats"], _state["meta"]


def _geodetic_to_ecef(lat, lon, alt_km):
    a, f = 6378.137, 1 / 298.257223563
    e2 = f * (2 - f)
    la, lo = math.radians(lat), math.radians(lon)
    n = a / math.sqrt(1 - e2 * math.sin(la) ** 2)
    return np.array([
        (n + alt_km) * math.cos(la) * math.cos(lo),
        (n + alt_km) * math.cos(la) * math.sin(lo),
        (n * (1 - e2) + alt_km) * math.sin(la),
    ])


def _gmst(jd, fr):
    return np.radians((280.46061837 + 360.98564736629 * (jd + fr - 2451545.0)) % 360)


def screen(lat, lon, alt_km, when: datetime, radius_km=10.0):
    """when must be a timezone-aware UTC datetime."""
    sats, meta = _get_sats()
    jd, fr = jday(when.year, when.month, when.day, when.hour, when.minute,
                  when.second + when.microsecond / 1e6)
    err, pos, _ = sats.sgp4(np.array([jd]), np.array([fr]))
    pos, err = pos[:, 0, :], err[:, 0]          # TEME km, shape (n, 3)

    # Sidereal angle, then rotate the entry point from Earth-fixed into TEME
    gmst = math.radians((280.46061837 + 360.98564736629 * (jd + fr - 2451545.0)) % 360)
    c, s = math.cos(gmst), math.sin(gmst)
    ex, ey, ez = _geodetic_to_ecef(lat, lon, alt_km)
    target = np.array([ex * c - ey * s, ex * s + ey * c, ez])

    dist = np.linalg.norm(pos - target, axis=1)
    dist[err != 0] = np.inf                      # skip objects SGP4 couldn't propagate
    near_idx = np.where(dist <= radius_km)[0]

    # Debris positions as lat/lon/alt for drawing (spherical approximation is fine for visuals)
    x_e = pos[:, 0] * c + pos[:, 1] * s
    y_e = -pos[:, 0] * s + pos[:, 1] * c
    r = np.linalg.norm(pos, axis=1)
    lats = np.degrees(np.arcsin(pos[:, 2] / r))
    lons = np.degrees(np.arctan2(y_e, x_e))
    alts = r - 6371.0
    ok = err == 0

    return {
        "radius_km": radius_km,
        "clear": len(near_idx) == 0,
        "nearby": sorted(
            [{"name": meta[i][0], "norad_id": meta[i][1], "distance_km": round(float(dist[i]), 2),
              "lat": round(float(lats[i]), 3), "lon": round(float(lons[i]), 3), "alt_km": round(float(alts[i]), 1)}
             for i in near_idx],
            key=lambda d: d["distance_km"]),
        "cloud": [[round(float(a), 3), round(float(b), 3), round(float(c_), 1)]
                  for a, b, c_ in zip(lats[ok], lons[ok], alts[ok])],
    }


def screen_path(points, start: datetime, radius_km=10.0):
    """points: [{t_sec, lat, lon, alt_km}] in Earth-fixed coordinates.
    start: timezone-aware UTC datetime at t_sec = 0."""
    sats, meta = _get_sats()
    n_sats, n_t = len(meta), len(points)
    t_arr = np.array([p["t_sec"] for p in points])

    jd, fr = np.empty(n_t), np.empty(n_t)
    for k, p in enumerate(points):
        t = start + timedelta(seconds=p["t_sec"])
        jd[k], fr[k] = jday(t.year, t.month, t.day, t.hour, t.minute, t.second + t.microsecond / 1e6)

    # Where the rocket is at each sample, rotated into the same frame as the debris (TEME)
    ecef = np.array([_geodetic_to_ecef(p["lat"], p["lon"], p["alt_km"]) for p in points])
    g = _gmst(jd, fr)
    c, s = np.cos(g), np.sin(g)
    target = np.stack([ecef[:, 0] * c - ecef[:, 1] * s,
                       ecef[:, 0] * s + ecef[:, 1] * c,
                       ecef[:, 2]], axis=1)

    best = np.full(n_sats, np.inf)      # closest approach per object (km)
    best_t = np.zeros(n_sats)           # when it happens (seconds after liftoff)
    idx = np.arange(n_sats)
    CH = 20                             # process 20 time steps at a time to keep memory small

    for a in range(0, n_t - 1, CH):
        b = min(a + CH + 1, n_t)        # one extra sample so segments cross chunk borders
        err, pos, _ = sats.sgp4(jd[a:b], fr[a:b])          # (N, m, 3)
        rel = pos - target[None, a:b, :]                   # debris relative to rocket
        r0, r1 = rel[:, :-1, :], rel[:, 1:, :]
        seg = r1 - r0

        # Closest approach within each segment, assuming straight-line relative motion.
        # Samples are several seconds apart and objects close at km/s, so checking only
        # the sample points could jump right over a near miss.
        denom = np.maximum(np.einsum('ntk,ntk->nt', seg, seg), 1e-9)
        u = np.clip(-np.einsum('ntk,ntk->nt', r0, seg) / denom, 0.0, 1.0)
        d = np.linalg.norm(r0 + u[..., None] * seg, axis=2)  # (N, m-1)
        d[(err[:, :-1] != 0) | (err[:, 1:] != 0)] = np.inf

        k = d.argmin(axis=1)
        m = d[idx, k]
        kk = a + k
        tt = t_arr[kk] + u[idx, k] * (t_arr[kk + 1] - t_arr[kk])
        better = m < best
        best[better] = m[better]
        best_t[better] = tt[better]

    hits = np.where(best <= radius_km)[0]
    hits = hits[np.argsort(best[hits])]

    def row(i):
        return {"name": meta[i][0], "norad_id": meta[i][1],
                "distance_km": round(float(best[i]), 2), "t_sec": round(float(best_t[i]), 1)}

    closest = int(np.argmin(best)) if n_sats and np.isfinite(best.min()) else None
    return {
        "radius_km": radius_km,
        "clear": len(hits) == 0,
        "objects_screened": n_sats,
        "closest": row(closest) if closest is not None else None,
        "conflict_count": int(len(hits)),
        "conflicts": [row(i) for i in hits[:20]],
    }
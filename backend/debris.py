import json, math, time
from datetime import datetime
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
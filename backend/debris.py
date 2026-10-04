import json, math, time
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import requests
from sgp4 import omm
from sgp4.api import Satrec, SatrecArray, jday

URL = "https://celestrak.org/NORAD/elements/gp.php"
QUERIES = [{"NAME": "DEB"}, {"GROUP": "active"}]          # or [{"GROUP": "cosmos-2251-debris"}, ...]
CACHE = Path(__file__).parent / "debris_cache.json"
MAX_AGE_S = 3 * 3600                 # don't hit CelesTrak more often than this

_state = {"sats": None, "meta": None, "loaded_at": 0}


def _load_records():
    fresh = CACHE.exists() and time.time() - CACHE.stat().st_mtime < MAX_AGE_S
    if not fresh:
        try:
            records = []
            for query in QUERIES:
                response = requests.get(URL, params={**query, "FORMAT": "JSON"}, timeout=30)
                response.raise_for_status()
                records += response.json()
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
                satellite = Satrec()
                omm.initialize(satellite, fields)
                sats.append(satellite)
                meta.append((fields["OBJECT_NAME"], fields["NORAD_CAT_ID"]))
            except Exception:
                continue
        _state.update(sats=SatrecArray(sats), meta=meta, loaded_at=time.time())
    return _state["sats"], _state["meta"]


def _geodetic_to_ecef(lat, lon, alt_km):
    equator_radius_km, flattening = 6378.137, 1 / 298.257223563
    e2 = flattening * (2 - flattening)
    lat_rad, lon_rad = math.radians(lat), math.radians(lon)
    prime_vertical_radius = equator_radius_km / math.sqrt(1 - e2 * math.sin(lat_rad) ** 2)
    return np.array([
        (prime_vertical_radius + alt_km) * math.cos(lat_rad) * math.cos(lon_rad),
        (prime_vertical_radius + alt_km) * math.cos(lat_rad) * math.sin(lon_rad),
        (prime_vertical_radius * (1 - e2) + alt_km) * math.sin(lat_rad),
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
    cos_gmst, sin_gmst = math.cos(gmst), math.sin(gmst)
    ex, ey, ez = _geodetic_to_ecef(lat, lon, alt_km)
    target = np.array([ex * cos_gmst - ey * sin_gmst, ex * sin_gmst + ey * cos_gmst, ez])

    dist = np.linalg.norm(pos - target, axis=1)
    dist[err != 0] = np.inf                      # skip objects SGP4 couldn't propagate
    near_idx = np.where(dist <= radius_km)[0]

    # Debris positions as lat/lon/alt for drawing (spherical approximation is fine for visuals)
    x_e = pos[:, 0] * cos_gmst + pos[:, 1] * sin_gmst
    y_e = -pos[:, 0] * sin_gmst + pos[:, 1] * cos_gmst
    distance_from_centre = np.linalg.norm(pos, axis=1)
    lats = np.degrees(np.arcsin(pos[:, 2] / distance_from_centre))
    lons = np.degrees(np.arctan2(y_e, x_e))
    alts = distance_from_centre - 6371.0
    ok = err == 0

    return {
        "radius_km": radius_km,
        "clear": len(near_idx) == 0,
        "nearby": sorted(
            [{"name": meta[sat_index][0], "norad_id": meta[sat_index][1], "distance_km": round(float(dist[sat_index]), 2),
              "lat": round(float(lats[sat_index]), 3), "lon": round(float(lons[sat_index]), 3), "alt_km": round(float(alts[sat_index]), 1)}
             for sat_index in near_idx],
            key=lambda entry: entry["distance_km"]),
        "cloud": [[round(float(object_lat), 3), round(float(object_lon), 3), round(float(object_alt), 1)]
                  for object_lat, object_lon, object_alt in zip(lats[ok], lons[ok], alts[ok])],
    }


def screen_path(points, start: datetime, radius_km=10.0):
    """points: [{t_sec, lat, lon, alt_km}] in Earth-fixed coordinates.
    start: timezone-aware UTC datetime at t_sec = 0."""
    sats, meta = _get_sats()
    n_sats, n_t = len(meta), len(points)
    t_arr = np.array([point["t_sec"] for point in points])

    jd, fr = np.empty(n_t), np.empty(n_t)
    for step, point in enumerate(points):
        sample_time = start + timedelta(seconds=point["t_sec"])
        jd[step], fr[step] = jday(sample_time.year, sample_time.month, sample_time.day, sample_time.hour, sample_time.minute, sample_time.second + sample_time.microsecond / 1e6)

    # Where the rocket is at each sample, rotated into the same frame as the debris (TEME)
    ecef = np.array([_geodetic_to_ecef(point["lat"], point["lon"], point["alt_km"]) for point in points])
    gmst_angle = _gmst(jd, fr)
    cos_gmst, sin_gmst = np.cos(gmst_angle), np.sin(gmst_angle)
    target = np.stack([ecef[:, 0] * cos_gmst - ecef[:, 1] * sin_gmst,
                       ecef[:, 0] * sin_gmst + ecef[:, 1] * cos_gmst,
                       ecef[:, 2]], axis=1)

    best = np.full(n_sats, np.inf)      # closest approach per object (km)
    best_t = np.zeros(n_sats)           # when it happens (seconds after liftoff)
    idx = np.arange(n_sats)
    CH = 20                             # process 20 time steps at a time to keep memory small

    for chunk_start in range(0, n_t - 1, CH):
        chunk_end = min(chunk_start + CH + 1, n_t)        # one extra sample so segments cross chunk borders
        err, pos, _ = sats.sgp4(jd[chunk_start:chunk_end], fr[chunk_start:chunk_end])          # (objects, samples, 3)
        rel = pos - target[None, chunk_start:chunk_end, :]                   # debris relative to rocket
        r0, r1 = rel[:, :-1, :], rel[:, 1:, :]
        seg = r1 - r0

        # Closest approach within each segment, assuming straight-line relative motion.
        # Samples are several seconds apart and objects close at km/s, so checking only
        # the sample points could jump right over a near miss.
        denom = np.maximum(np.einsum('ntk,ntk->nt', seg, seg), 1e-9)
        segment_fraction = np.clip(-np.einsum('ntk,ntk->nt', r0, seg) / denom, 0.0, 1.0)
        segment_distance = np.linalg.norm(r0 + segment_fraction[..., None] * seg, axis=2)  # (objects, samples - 1)
        segment_distance[(err[:, :-1] != 0) | (err[:, 1:] != 0)] = np.inf

        closest_step = segment_distance.argmin(axis=1)
        chunk_best = segment_distance[idx, closest_step]
        closest_sample = chunk_start + closest_step
        closest_time = t_arr[closest_sample] + segment_fraction[idx, closest_step] * (t_arr[closest_sample + 1] - t_arr[closest_sample])
        better = chunk_best < best
        best[better] = chunk_best[better]
        best_t[better] = closest_time[better]

    hits = np.where(best <= radius_km)[0]
    hits = hits[np.argsort(best[hits])]

    def row(sat_index):
        return {"name": meta[sat_index][0], "norad_id": meta[sat_index][1],
                "distance_km": round(float(best[sat_index]), 2), "t_sec": round(float(best_t[sat_index]), 1)}

    closest = int(np.argmin(best)) if n_sats and np.isfinite(best.min()) else None
    return {
        "radius_km": radius_km,
        "clear": len(hits) == 0,
        "objects_screened": n_sats,
        "closest": row(closest) if closest is not None else None,
        "conflict_count": int(len(hits)),
        "conflicts": [row(sat_index) for sat_index in hits[:20]],
    }
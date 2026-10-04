import requests
from datetime import datetime, timedelta


def parse_time(time_string):
    if time_string is None:
        return None

    return datetime.fromisoformat(
        time_string.replace("Z", "+00:00")
    )

def get_cape_launches():
    url = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/"

    params = {
        "format": "json",
        "limit": 100
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()

    launches = []

    for launch in data["results"]:
        location = launch["pad"]["location"]["name"]
        window_start = launch["window_start"]
        window_end = launch["window_end"]

        if "Cape Canaveral" in location:
            launches.append({
                "name": launch["name"],
                "window_start": parse_time(window_start),
                "window_end": parse_time(window_end)
            })

    return launches

def get_ns_launches():
    url = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/"

    params = {
        "format": "json",
        "limit": 100
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()

    launches = []

    for launch in data["results"]:
        location = launch["pad"]["location"]["name"]
        window_start = launch["window_start"]
        window_end = launch["window_end"]

        if "Nova Scotia" in location or "Canso" in location:
            launches.append({
                "name": launch["name"],
                "window_start": parse_time(window_start),
                "window_end": parse_time(window_end)
            })

    return launches


# Words that identify each site in The Space Devs pad location names
SITE_LOCATION_WORDS = {
    "CapeCanaveral": ["Cape Canaveral", "Kennedy Space Center"],
    "Nova-Scotia": ["Nova Scotia", "Canso"],
    "Vandenberg": ["Vandenberg"],
    "Wallops": ["Wallops"],
    "Kourou": ["Guiana", "Kourou"],
    "Baikonur": ["Baikonur"],
    "Tanegashima": ["Tanegashima"],
    "Starbase": ["Starbase", "Boca Chica"],
}


def get_all_upcoming_launches():
    """Every upcoming launch (one request), each with its pad location name."""
    url = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/"
    response = requests.get(url, params={"format": "json", "limit": 100}, timeout=15)
    response.raise_for_status()
    return [
        {
            "name": launch["name"],
            "location": launch["pad"]["location"]["name"],
            "window_start": parse_time(launch["window_start"]),
            "window_end": parse_time(launch["window_end"]),
        }
        for launch in response.json()["results"]
    ]


def launches_at_site(all_launches, launch_site):
    """The launches from get_all_upcoming_launches() that use this site."""
    words = SITE_LOCATION_WORDS.get(launch_site, [])
    return [launch for launch in all_launches if any(word in launch["location"] for word in words)]


def windows_overlap(start1, end1, start2, end2):
    return start1 < end2 and start2 < end1


def filter_conflicting_windows(windows, launches):
    available_windows = []

    for window in windows:
        conflict = False

        for launch in launches:
            launch_start = launch["window_start"]
            launch_end = launch["window_end"]

            # Some upcoming launches don't have a window yet: skip ones with no start,
            # and treat a missing end as a one-hour window (comparing with None crashes)
            if launch_start is None:
                continue
            if launch_end is None:
                launch_end = launch_start + timedelta(hours=1)

            if windows_overlap(
                window["start"],
                window["end"],
                launch_start,
                launch_end
            ):
                conflict = True
                break

        if not conflict:
            available_windows.append(window)

    return available_windows
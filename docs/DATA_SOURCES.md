# Data Sources Register

This register documents all transport datasets, timetables, fares, and synthetic assets integrated into the Chennai Transit Mobility database, derived directly from `SOURCE_REGISTER.csv`.

## CSV Set Integrity

- **Database Table:** `_meta`
- **Key:** `csv_set_sha256`
- **SHA256 Checksum:** `887e466315d22dcf01f4e2fd0bd51f59140ef530a08d439ed949d49837d45a55`

---

## Source Register Table

| Source ID | Publisher / Organisation | URL | Retrieval Date | Dataset Date | Classification | Licence & Restrictions | Commercial-Use Status | Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`S_MTC_GTFS`** | UngalSoththu / ChennaiGTFS; data attributed to MTC app | [Raw GTFS Link](https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/mtc-gtfs.zip) | 2026-11-05 | 2026-04-27 | THIRD_PARTY_DERIVED | ODbL/PDDL claimed for compilation; upstream MTC rights unclear | Commercial permission UNCERTAIN; obtain MTC and compiler clarification | Not official GTFS publication; calendar dates do not verify currency; no live data. |
| **`S_CMRL_GTFS`** | UngalSoththu / CUMTA / CMRL | [Raw CMRL GTFS Link](https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl-gtfs.zip) | 2026-11-05 | 2026-10-04 | THIRD_PARTY_MIRROR_OF_OFFICIAL | ODbL/PDDL compilation claimed; source licence unspecified and copyright reserved | UNCERTAIN; obtain CUMTA/CMRL approval | Historic timetable calendar expires 2021-12-31; fares 2021; excludes 2026 yellow line. |
| **`S_SRR_GTFS`** | UngalSoththu / CUMTA / Southern Railway | [Raw SRR GTFS Link](https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/srr-gtfs.zip) | 2026-11-05 | 2026-10-04 | THIRD_PARTY_MIRROR_OF_OFFICIAL | ODbL/PDDL compilation claimed; source licence unspecified and copyright reserved | UNCERTAIN; obtain CUMTA/Southern Railway approval | Long calendar end is not proof of validity; November 2026 revision. |
| **`S_MTC_FARES`** | Metropolitan Transport Corporation | [MTC Fares](https://mtcbus.tn.gov.in/Home/fares) | 2026-11-05 | — | OFFICIAL | No explicit data licence located | UNCERTAIN; seek MTC approval | Page carries blanket 2018-01-29 effective date; later categories may have separate introduction dates. |
| **`S_MTC_PASSES`** | Metropolitan Transport Corporation | [MTC Passes](https://mtcbus.tn.gov.in/Home/travelasyou/11) | 2026-11-05 | — | OFFICIAL | No explicit data licence located | UNCERTAIN; seek MTC approval | Eligibility and terms require current confirmation. |
| **`S_MTC_FACILITY`** | Metropolitan Transport Corporation | [MTC Facilities](https://mtcbus.tn.gov.in/Home/facilities) | 2026-11-05 | — | OFFICIAL | No explicit data licence located | UNCERTAIN; seek MTC approval | No exhaustive eligibility data; newer policy must be checked. |
| **`S_YELLOW`** | Chennai Metro Rail Limited | [Press Release PDF](https://chennaimetrorail.org/wp-content/uploads/2026/10/Press-Release-10.10.2026-English.pdf) | 2026-11-05 | 2026-10-10 | OFFICIAL | No explicit data licence located | UNCERTAIN; seek CMRL approval | Names and sequence official; identifiers locally created, no official station IDs or coordinates. |
| **`S_CMRL_ACCESS`** | Chennai Metro Rail Limited | [CMRL Accessibility](https://chennaimetrorail.org/facilities-for-differently-abled-people/) | 2026-11-05 | — | OFFICIAL | No explicit data licence located | UNCERTAIN; seek CMRL approval | Systemwide design claim; not evidence a specific facility is functional. |
| **`S_EXAMPLES`** | Project-authored synthetic utterances | — | 2026-11-05 | 2026-11-05 | SYNTHETIC | Created for this deliverable; no third-party transport facts | Usable subject to upstream location names and review | Not recorded passenger speech; not independently validated Tamil/Tanglish ASR pronunciations. |
| **`S_CMRL_CURRENT_FARES`** | Chennai Metro Rail Limited | [CMRL Fare Table](https://chennaimetrorail.org/cmrl-fare-table/) | 2026-11-05 | 2026-10-09 | OFFICIAL | No explicit data licence located | UNCERTAIN; seek CMRL approval | Official current table linked as PDF; machine extraction not validated in this package. |
| **`S_RAIL_REVISION`** | DT Next reporting Southern Railway | [DT Next Report](https://www.dtnext.in/news/chennai/timetable-revised-for-chennai-suburban-trains-from-november-1) | 2026-11-05 | 2026-10-30 | THIRD_PARTY_REPORT | Copyright; no redistribution licence located | UNCERTAIN; seek publisher approval | Reports revisions effective 2026-11-01; not a full official timetable. |
| **`S_NTES`** | CRIS / Indian Railways | [CRIS NTES](https://cris.org.in/loadpage?page=proNTES) | 2026-11-05 | — | OFFICIAL | No developer API licence identified | Public API/auth/permission UNKNOWN; request CRIS approval | Live passenger enquiry; suburban coverage and machine API access not established. |
| **`S_MTC_LIVE`** | MTC / Chalo | [MTC Live](https://mtcbus.tn.gov.in/) | 2026-11-05 | — | OFFICIAL | No developer API licence identified | Public API/auth/permission UNKNOWN; request MTC/Chalo approval | Consumer live app exists; no authorised machine feed demonstrated. |
| **`S_GTFS_REPO`** | UngalSoththu | [GitHub Repo](https://github.com/ungalsoththu/ChennaiGTFS) | 2026-11-05 | 2026-10-04 | THIRD_PARTY | ODbL/PDDL claimed for compilation; MIT code licence also displayed | UNCERTAIN until rights clarified | Original collection, caveats and licensing claims. |
| **`S_CMRL_TIME`** | CMRL | [Time Table PDF](https://chennaimetrorail.org/wp-content/uploads/2026/10/Time-Table.pdf) | 2026-11-05 | 2026-10-10 | OFFICIAL | No explicit data licence located | UNCERTAIN; seek CMRL approval | Indexed by web search, direct attempted download returned HTML error; not transcribed. |
| **`S_MAP`** | Reclaim Chennai | [MTC Bus Map](https://github.com/reclaimchennai/mtc-bus-map) | 2026-11-05 | — | THIRD_PARTY | ODbL claimed for derived data; upstream permissions unknown | UNCERTAIN; obtain author and operator approval | Unofficial collector; reported ETAs are modeled, not official arrival predictions. |


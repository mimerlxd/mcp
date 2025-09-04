Kort svar: **start med DB på samme MCP-container** (men på et separat mount/volume), og gør det nemt at flytte ud i en dedikeret DB-LXC senere. Det giver lav latenstid, mindst ops-friktion, og en klar opgraderingsvej.

# Beslutningsguide (kort)

**Når DB i samme container er bedst**

* MVP / lav til moderat load (primært læsning/top-K søg).
* Du vil have *meget* lav latenstid mellem app ↔ vektor-indeks.
* Du vil rulle ofte og holde drift simpel.
* Du bruger libSQL/SQLite (ingen netværks-roundtrips er ofte hurtigst).

**Når dedikeret DB-LXC er bedst**

* Flere MCP-services skal dele samme data (multi-writer/multi-reader).
* Tung ingestion/batch (re-embed) skal kunne ske uden at påvirke API-SLA.
* Ressource-isolering (RAM/IO) eller særskilt backup/restore-cyklus.
* Du vil tilføje replikering/HA (fx libSQL server + read-replicas).

# Anbefalet layout (trinvis)

## Fase 1 – Samme container, men separér data

* Instance: `mcp-know-prod`
* Mount en dedikeret disk/volume til DB:

  * LXD: `lxc config device add mcp-know-prod dbdisk disk source=/zfs/mcp-db path=/var/lib/mcp-db`
* Kør libSQL (embedded eller lokal `sqld`) i samme container.
* Tuning:

  * `PRAGMA journal_mode=WAL;`
  * `PRAGMA synchronous=NORMAL;`
  * `PRAGMA mmap_size` (høj), `PRAGMA cache_size` (negativt tal for KB).
* Backup:

  * LXD snapshot på **volumet** + periodevis `sqlite .backup`.
* Fordel: Minimal kompleksitet, laveste latenstid.
* Ulempe: App-CPU/IO kan påvirke DB ved spidsbelastning.

## Fase 2 – Flyt til dedikeret DB-LXC

* Instance: `mcp-db-prod` (kun DB + Tailscale).
* App peger på `libsql://mcp-db-prod.tailnet:8081` (kun tailnet).
* Giv DB-LXC flere IO-ressourcer (storage pool med ZFS/Btrfs, `zfs recordsize=16k`).
* Fordel: Isolation, delt af flere MCP-apps, udrul DB uafhængigt.
* Ulempe: +1 net-hop (typisk ubetydeligt i tailnet, men måles).

## Fase 3 – Replika/HA (hvis nødvendigt)

* Primær `mcp-db-prod` + read-replica `mcp-db-replica` (kun læs).
* MCP læser mod replica, skriver mod primær.
* Rullende re-embed/ingest uden at ramme læse-SLA.

# Praktiske råd til din stack

* **libSQL + vectors**: passer fint til co-location. ANN-opslag er læsetunge → hold DB-cache varm.
* **Tailscale**: eksponér **kun app** via Serve; DB-LXC kan være *kun tailnet-IP* (ingen Serve).
* **Per-projekt DB vs. én samlet**:

  * Start med **én DB** med `project` kolonne (nemmere at søge tværgående).
  * Ved vækst: split “støjende” projekter ud i egne DB’er (enkelt, da du mount’er per DB).
* **Ingestion**: kør batch/re-embed i separat job/queue for at undgå IO-støj, også i fase 1.
* **Observability**: log p95 for `rules.search`/`project.search`; hvis p95 stiger ved ingestion → overvej fase 2.

# Konklusion

* **Start simpelt**: DB på samme MCP-container, men på eget mount for nem flytning.
* **Mål** (latency/IO). Hvis du ser contention eller får flere forbrugere, **flyt DB til egen LXC** og aktiver read-replica senere.
* Denne vej holder udvikling hurtig nu og giver en glidende opgradering uden arkitektur-rework.

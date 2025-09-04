# Formål
Etablere en **MCP-baseret viden- og regelsuite** i dit tailnet, som LLM’er kan tilgå sikkert via MCP og simple HTTP-endpoints. Løsningen består af én fleksibel MCP-server med modulære domæner (Rules, Project Docs, Refs) og en letvægts *sender-app* til ingestion fra projekter. Arkitekturen er designet til: (1) **høj udviklingshastighed**, (2) **flere MCP-kanaler**/tenants, (3) **enkelt drift** i LXD/Tailscale, (4) **semantisk søgning** via libSQL vectors.

---

## Mål & succeskriterier
- **MCP-first:** Alle funktioner eksponeres som MCP tools/resources; HTTP-API er sekundært til ingestion/health.
- **Sikkerhed i tailnet:** Kun tilgængelig via Tailscale Serve (identity headers / LocalAPI whois).
- **Semantisk søg:** Regler og dokumenter kan slås op med top‑K, filtreret på projekt/tags/tier.
- **Multikanal:** Samme binær kan køre flere **MCP kanaler** (f.eks. `rules`, `project:<navn>`, `refs`, plus fremtidige).
- **Hurtig ingestion:** Én kommando pusher repoets docs/README/rules m.m. til vektorbasen.
- **Observability:** Auditlog per tailnet-bruger, simple metrics, og reproducible backups.

---

## Domæner (MVP)
1) **Rules Service (global)**
   - Formål: Centrale AI-udviklingsregler, coding standards, designkrav, policy.
   - MCP tools: `rules.search`, `rules.get`, `rules.tags`.
   - Scope: Læse‑only for LLM, ingestion via admin‑endpoint.

2) **Project Docs Service (pr. projekt/kanal)**
   - Formål: Projekt‑specifik viden (README, docs, route/API kontrakter, kommentarer, TODO, osv.).
   - MCP tools: `project.search`, `project.browse`, `project.contextPack` (leverer et kurateret kort kontekst‑bundle).
   - Multitenancy: Kanal pr. projekt (navn bliver en del af MCP‑resource namespace).

3) **Docs & Links (Refs)**
   - Formål: Hurtige referencekort med titel, URL, note, tags.
   - MCP tools: `refs.list`, `refs.add` (styret af tier/rolle), `refs.findByTag`.

---

## Høj-niveau arkitektur
- **Transport & identitet**: Tailscale Serve → injicerer *Tailscale-User-Login*; server lytter kun på localhost.
- **MCP Server**: TypeScript (SDK) for hurtig *tool/resource* udvikling og dynamisk kanalmapping.
- **Data & søgning**: libSQL (hostet eller self‑host) med **native vector** kolonner + ANN-indeks.
- **Ingestion**: HTTP endpoints (kun i tailnet) + CLI sender (TS). Eventuel Go‑ingester for store repos.
- **Scalability**: Vandret skalerbar på kanalniveau; lokal cache til varme queries.
- **Observability**: JSON auditlog + basic metrics (p95, top‑queries, index‑health).

---

## Teknologi‑valg (begrunde kort)
- **TypeScript (MCP + sender‑CLI)**: Hurtig iteration, rigt MCP‑SDK, nemt at tilføje nye tools/resources.
- **Go (edge workers / batch‑ingestion)**: Robust streaming, parallel file‑walk/embedding ved store datasæt.
- **Haxe (valgfri adapters/DSL)**: Generere cross‑target util‑libs (f.eks. konvertere projektdocs → LLM‑venlige chunks) og sikre deterministiske parsere.
- **libSQL**: SQLite‑økosystem + **vector** datatype og `vector_top_k()` → enkel drift, stærk performance.
- **Tailscale**: Zero‑trust i tailnet; Serve/ACLs/Groups til tiering og adgangs‑gate.

---

## MCP-kanaldesign
- **Kanalnavne**: `rules`, `project:<slug>`, `refs`, `sys:admin` (fremtidig), `kb:<team>`, etc.
- **Dynamisk discovery**: Server læser en **channels.json** (eller DB) ved start og registrerer tools/resources pr. kanal.
- **Namespaces**: MCP resource URIs: `mcp://rules/...`, `mcp://project/<slug>/...`, `mcp://refs/...`.
- **Konfig‑hot‑reload**: SIGHUP eller `/admin/reload` for at tilføje/ændre kanaler uden downtime.

---

## Data‑model (skitse)
- `rules_global(id, title, body, tags_csv, updated_at, embedding)`
- `project_docs(id, project, path, kind, body, tags_csv, updated_at, embedding)`
- `refs(id, title, url, note, tags_csv, created_at)`
- `access_tiers(login, tier)`

**Indexering**: `libsql_vector_idx(embedding)` på både rules og project_docs. Standard text‑kolonner til metadatafiltre.

---

## API (MVP) — uden kode
**HTTP (ingestion/admin, tailnet‑only)**
- `POST /ingest/rule` → title, body, tags_csv
- `POST /ingest/project` → project, path, kind, body, tags_csv
- `POST /refs` → title, url, note, tags_csv
- `GET  /refs?tags=...`
- `GET  /health`, `GET /admin/metrics`, `POST /admin/reload`

**MCP Tools (læse/søg)**
- `rules.search(q, k?, tags?)`
- `project.search(project, q, k?)`
- `refs.list(tags?)`, `refs.add(title, url, note?, tags_csv?)` (rolle/tier‑beskyttet)

**Kanal‑mapping**
- MCP‑client forbinder til `https://<host>.<tailnet>.ts.net/mcp` (SSE) og vælger channel via session‑param eller tool‑args.

---

## Sikkerhed & adgang
- **Tailnet only**: Kun via Serve; app lytter på 127.0.0.1. Identity headers læses på server.
- **Tiering**: `access_tiers` i DB; mapping fra `Tailscale-User-Login` → tier. Filtrér resultater pr. tier (tags eller projekttilknytning).
- **ACLs**: Tailscale ACL styrer *netværksadgang* (hvem kan nå URL’en). App‑niveau styrer *data‑adgang*.
- **Audit**: Log struktureret: {ts, login, tool, argsHash, k, elapsedMs, matches}.

---

## Observability & drift
- **Metrics**: Requests, p50/p95, top‑queries, ingest latency, DB‑size, index‑health.
- **Backups**: libSQL snapshots + eksport af refs; versionering af rules/project ingestion (source‑hash pr. dokument).
- **Rollouts**: Blue/green i LXD projekter; config in Vault/Tailscale vars.

---

## Udviklingsworkflow
1. **Design kontrakter**
   - `channel-config.json` (kanaler/resources/tools)
   - `ingest-policy.json` (hvad hentes, filtyper, chunking, max‑størrelse)
   - `naming‑book.json` (tags, kategorier, standarder)
2. **Implementér MCP tools** (TS) pr. domæne.
3. **Ingestion‑CLI** (TS) → scan repo, normaliser, POST til server.
4. **Indexering** → libSQL vector‑indeks + tags.
5. **E2E test** → kontrakt‑test af tools, k‑nøjagtighed, performance, og rettigheder.

---

## Test & kvalitet
- **Kontrakt‑tests**: JSON‑baserede tool‑specs (input→forventet shape, filters, grænser).
- **Eval af søgning**: Ground‑truth sæt pr. domain; mål MRR/NDCG på små kuraterede queries.
- **Load‑test**: Query‑burst (top‑K 5/10/20) og ingestion af store repos (parallelt); mål p95 < 150ms for varme queries.

---

## Performance‑strategier
- **Client‑side prompts**: LLM agent beder om `contextPack` (kompakt bundle) fremfor mange individuelle hits.
- **Resultat‑cache**: In‑memory LRU pr. kanal og q‑hash.
- **Batch‑embed**: Ingestion i batches; Go‑worker til meget store repos.
- **Cold‑start minimization**: Preload af hyppige regler/tags.

---

## Udrulning (LXD/Tailscale)
- LXD instance pr. miljø (`mcp-dev`, `mcp-prod`).
- `tailscale serve 8080` → HTTPS URL i tailnet.
- Vault til secrets (LIBSQL DSN, embed API nøgle).
- CI/CD: Byg TS/Go artefakter, kør kontrakt‑tests, migrer DB schema, rull ud.

---

## Lille binær (Go) — MCP/STDIO/REST helper
**Formål:** Én lille statisk Go‑binær der fungerer som lokal indgang for alle klienter. Den eksponerer **lokal MCP** (stdio/SSE) til LLM’er/IDE’er, og **proxy’er** kald videre til den centrale server via **REST** (tailnet URL). Hvis MCP ikke er tilgængelig på klienten, bruges REST direkte. Samme kontrakter på tværs.

### Roller
- **Lokal MCP‑server**: Tools `rules.search`, `project.search`, `refs.*` eksponeres lokalt som MCP. 
- **STDIO‑mode**: For redskaber der forventer MCP over stdio (CLI/agents).
- **REST‑client**: Al faktisk data hentes/skrives til central service via REST (tailnet), med fallback‑cache lokalt.
- **Ingestion‑CLI**: `ingest` kommando scanner repo og pusher dokumenter til serverens `/v1/ingest/project`.

### Kørselstilstande
- `serve`  – start lokal MCP (stdio og/eller SSE) og REST‑proxy.
- `ingest` – batch push af filer (filfilter, chunking, parallel embeds via server).
- `context` – bygg et kompakt context‑bundle (rules + topK projektuddrag + refs) til LLM.
- `diag`    – healthcheck, latency‑måling, whois/identity‑print, cache‑status.

### CLI‑skitse (uden kode)
- `tailmcp serve --stdio --sse :5173 --base https://host.tailnet.ts.net --project forfatter-pwa`
- `tailmcp ingest --project forfatter-pwa --root . --include "**/*.{md,mdx,ts,tsx,go,txt}"`
- `tailmcp refs add --title "Design Spec" --url https://... --tags a11y,ui`
- `tailmcp search rules --q "kontrast" --k 8`  (diagnostisk wrapper over MCP/REST)

### Konfiguration
- Fil: `~/.config/tailmcp/config.yaml`
  - `base_url: https://<host>.<tailnet>.ts.net`
  - `default_project: forfatter-pwa`
  - `channels: [rules, project:forfatter-pwa, refs]`
  - `cache: {entries: 256, ttl: 10m}`
  - `transport: {prefer: mcp, fallback: rest}`

### Transportstrategi
1. **MCP tilstede?** Hvis klienten kan MCP stdio/SSE → servér lokalt MCP tools; binæren kalder REST mod serveren.
2. **Ellers REST** → samme kontrakter via HTTP. 
3. **Cache** → LRU pr. q‑hash, invalidér ved ingest events.

### Sikkerhed & identitet
- Binærens REST‑kald går til tailnet URL; serveren læser Tailscale identity headers og håndhæver tiers.
- Valgfri local whois‑check (debug): print tailnet‑identitet for forbindelser.

### Observability
- Struktureret log: `{ts, mode, tool, transport, project, k, ms, cacheHit}`.
- `tailmcp diag --latency --k 8 --q foo` viser p50/p95 og seneste fejl.

### Build & distribution
- Go 1.22+, statisk build for linux/amd64, linux/arm64, darwin/arm64.
- Egen versionering (semver), auto‑update flag senere.

### Acceptkriterier (helper)
- Starter lokal MCP (stdio/SSE) og svarer på `rules.search`/`project.search` med p95 < 200 ms (varm cache).
- Skifter automatisk til REST hvis MCP ikke er relevant.
- `ingest` kan uploade >=100 filer og invalidere cache.
- Identisk output (shape) via MCP og REST.

---

## Roadmap
**MVP (uge 1–2)**
- DB‑schema, MCP‑server skeleton, `rules.search`, `project.search`, `refs.list/add`.
- Ingestion‑CLI (TS), basis chunking, tailnet‑eksponering, metrics + auditlog.

**v0.2 (uge 3–4)**
- `contextPack` builder (kuraterer 2–3 bedste uddrag pr. facet).
- Admin mini‑UI (Refs/Rules oversigt, re‑ingest, tags).
- Go‑ingester til store repos; parallel embedding pipeline.

**v0.3 (uge 5–6)**
- Kanal‑hot‑reload, kanal‑templates, automatisk projekt‑oprettelse fra sender.
- WhoIs fallback (LocalAPI) og finere rolle/tier styring per projekt.
- Query‑explanations + bedre eval (NDCG dashboard).

**v0.4+**
- Haxe‑baserede parsere (statiske DSL’er), dokument‑normalisering, prompt‑lint.
- Konnektorer: Git webhook, Gitea/GitHub Actions ingestion, Obsidian vault sync.
- Policy‑enforcement tool (returnerer “system‑prompt” baseret på rules + projekt).

---

## Risici & mitigering
- **Model‑drift i embedding** → Hold `VECTOR_DIM` versioneret; migration scripts til re‑embed.
- **Data‑læks** → Tailnet‑only + tier‑filtre + audit; anonymiser følsomt indhold før ingestion.
- **Indeks‑inflation** → Retention/archiv policy; dedup med source‑hash; pruning strategier.

---

## Leverancer
- Arkitekturdiagram + `channel-config.json` skabelon
- DB‑schema + migrations
- MCP‑server (TS) skeleton med tre domæner
- Ingestion‑CLI (TS) + opskrift til Go batch‑ingester
- Driftshåndbog (Serve/ACL, backup, metrics, rollout)
- Testpakke (kontrakter + eval)

---

## Acceptkriterier (MVP)
- LLM‑klient kan kalde `rules.search` og `project.search` via MCP i tailnet.
- Repos kan pushes ind (min. 100 filer) og er søgbare < 200 ms p95 (varm cache).
- Refs kan tilføjes/listes og filtreres på tags.
- Auditlog viser login, tool, k, latency, antal matches.
- Kanalkonfiguration kan ændres uden down‑time (reload/endepunkt).

---

## Næste skridt
1) Godkend dette oplæg.
2) Beskriv **kanal‑listen** (projekter/teams) og **embedding‑model**(er) + dimension.
3) Vi producerer kontrakter (JSON) + migrations og starter på MVP‑skelettet.


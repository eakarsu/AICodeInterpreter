# Policy-gated sandbox job workflow

`/api/governed-jobs` accepts only checksummed object-storage artifacts, requires malware/PII scan release, pins an independently approved resource policy, enforces tenant active-job quotas, leases work to authenticated ephemeral workers, fixes network access to `deny`, records event streams and failures, and withholds output until a second artifact scan. Inline code/data and host execution are prohibited. The previous LLM “execute” route is not mounted as code execution.

Run `scripts/bootstrap.sh`, configure `.env`, apply `scripts/migrate.sh`, then run `start.sh`. Startup never installs, kills ports, creates/migrates/seeds databases, or executes code. The destructive legacy demo seed is explicitly guarded. Generated gap routes are unmounted.

Production microVM/container workers, queue/object storage, signed package mirrors, tracing, secret manager, artifact scanners, runtime escape testing and infrastructure isolation remain external blockers; this repository does not claim them.

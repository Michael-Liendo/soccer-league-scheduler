# Soccer League Scheduler

A small web app to run a local soccer cup: register the teams, plan how many matches are played
on each match day, and share a read-only calendar with the players. It was built for a
three-a-side cup played over four Saturdays in Naiguatá, Venezuela, so the interface is in Spanish.

- **Public view** (`/`): standings, calendar and results by match day, top scorers, cards, fair
  play and a sheet for every team. Made for phones; it refreshes by itself while matches are
  being played.
- **Admin panel** (`/admin`): protected by a private code. Create teams and players, plan and
  generate the calendar, record scores, goals and cards as they happen, move individual matches,
  and edit the cup settings.
- **Match day**: every match has a clock. Start it, tap "Gol" and pick the scorer, show cards, and
  the minute is stamped by itself. The order of play can be rearranged, and the public pages show
  what is on now and what comes next.
- **Teams in seconds**: paste the teams (and their players) as text, or paste the list of people
  and let the app draw balanced teams, keeping the strongest players apart.
- **Helpers**: the owner signs in with `ADMIN_CODE` and can create extra codes for people who
  help on match day. A helper can load teams and run matches, but cannot delete teams, players or
  results, rebuild the calendar or change settings. Revoking a code locks its sessions out at once.
- **Planner**: given the teams, the match days and the daily timetable, it compares one to four
  round-robin legs, recommends the format that gives every team two to three matches per day
  without running past the end time, and spreads the matches so teams rest between games.

Standings use three points for a win and one for a draw. Ties are broken by goal difference, goals
scored and fair play, in that order.

## Stack

[SvelteKit 3](https://svelte.dev/docs/kit) with Svelte 5 and TypeScript, SQLite through
[Drizzle ORM](https://orm.drizzle.team) and `better-sqlite3`, and `adapter-node`. Everything runs
in a single Node process with a single database file.

## Development

```sh
pnpm install
cp .env.example .env   # then set ADMIN_CODE
pnpm dev
```

| Command            | What it does                                                   |
| ------------------ | -------------------------------------------------------------- |
| `pnpm dev`         | Start the dev server                                           |
| `pnpm test`        | Run the unit tests                                             |
| `pnpm check`       | Type-check the project                                         |
| `pnpm lint`        | Check formatting and lint rules                                |
| `pnpm build`       | Build the production server into `build/`                      |
| `pnpm start`       | Run the production build                                       |
| `pnpm db:generate` | Write a migration after changing `src/lib/server/db/schema.ts` |

Migrations live in `drizzle/` and are bundled into the server, which applies the pending ones
every time it starts. There is no separate migration step when deploying.

## Configuration

| Variable       | Default    | Purpose                                                                                                                               |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_CODE`   | _(unset)_  | Private code for the admin panel, at least 6 characters. The panel stays disabled while it is unset. Changing it signs everybody out. |
| `DATABASE_URL` | `local.db` | Path of the SQLite file. The Docker image uses `/data/league.db`.                                                                     |
| `PORT`         | `3000`     | Port the server listens on.                                                                                                           |

The cup's name, place, field and players per side are edited in the admin panel. Dates and times
are those of `America/Caracas` (see `LEAGUE_TIME_ZONE` in `src/lib/league/format.ts`).

## Deploying with Coolify

The repository ships a `Dockerfile`, so a deployment needs three settings:

1. Create an application from this repository with the **Dockerfile** build pack and port `3000`.
2. Add the environment variable `ADMIN_CODE` with your private code.
3. Add a **persistent storage** volume mounted at `/data`, where the database is kept.

The health check answers on `/health`.

The image expects to run behind a reverse proxy that sets `X-Forwarded-Proto`,
`X-Forwarded-Host` and `X-Forwarded-For`, as Coolify's proxy does. SvelteKit uses them to know the
public address of the site and reject form posts coming from anywhere else. To run the image
without a proxy, clear `PROTOCOL_HEADER`, `HOST_HEADER` and `ADDRESS_HEADER` and serve it over
HTTPS.

## License

[MIT](LICENSE)

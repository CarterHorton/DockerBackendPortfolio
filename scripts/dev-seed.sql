-- LOCAL TESTING ONLY. Adds sample projects, journals and articles.
-- Run against the local Docker database:
--   docker compose exec -T db psql -U chorton -d portfolio < scripts/dev-seed.sql
-- Never run this on the live server.
-- Note: the article page already shows the title, so article content starts with ## sections.

INSERT INTO projects (title, content, start_date, end_date) VALUES
  ('Mountain Bike Trail Map', 'A small app for logging local trails, difficulty, and conditions after rain.', '2025-08-01', '2025-10-15'),
  ('Novel Draft Three', 'Tracking progress on the third book: outlining, drafting, and revision passes.', '2025-11-01', NULL),
  ('Homelab', 'Running my own server at home: nginx, Docker, Cloudflare tunnel, and backups.', '2026-01-10', NULL);

INSERT INTO journals (project_id, title, content, date_created)
SELECT p.id, j.title, j.content, j.created::timestamp
FROM (VALUES
  ('Mountain Bike Trail Map', 'Picking a map library', 'Compared a few options and settled on one that works offline. The trail data is just GeoJSON for now.', '2025-08-05'),
  ('Mountain Bike Trail Map', 'Rain reports', 'Added a quick way to mark a trail as muddy. Turns out this is the feature I use the most.', '2025-09-12'),
  ('Novel Draft Three', 'Outline done', 'Finished the outline. Three acts, twenty-four chapters, and one villain I am still not happy with.', '2025-11-20'),
  ('Homelab', 'nginx in front of Angular', 'Switched from ng serve to an nginx build. Pages load noticeably faster and it restarts cleanly.', '2026-02-02'),
  ('Homelab', 'Thinking about backups', 'If the disk dies tomorrow, what do I lose? Everything. Time to fix that with pg_dump and an offsite copy.', '2026-03-15'),
  ('Homelab', 'Power outage', 'The power went out overnight and the server did not come back on its own. Looking into the BIOS setting for restoring after power loss.', '2026-04-01')
) AS j(project, title, content, created)
JOIN projects p ON p.title = j.project;

INSERT INTO articles (title, summary, content, published, date_created, date_updated, date_published) VALUES
(
  'What I Learned Moving My Site Behind nginx',
  'Why a dev server is not a web server, and what changed when I switched.',
  E'For a long time my portfolio ran on `ng serve`. It worked, so I left it alone. Here is why I stopped.\n\n## The problem\n\n`ng serve` is a **development** server. It rebuilds on every change, keeps source maps around, and was never meant to face the internet.\n\n> A tool that works is not the same as a tool that is right for the job.\n\n## The fix\n\n1. Run `ng build` to produce static files.\n2. Point nginx at the `dist/` folder.\n3. Proxy `/api` to the backend.\n\n```nginx\nlocation /api/ {\n    proxy_pass http://localhost:3000/;\n}\n```\n\n## Results\n\n| | Before | After |\n|---|---|---|\n| First load | slow | fast |\n| Restarts | manual | automatic |\n\nThe biggest lesson: *read the docs for the thing you deploy*, not just the thing you build.',
  true, '2026-02-10', '2026-02-10', '2026-02-10'
),
(
  'Notes on Writing Fifty Thousand Words in a Month',
  'NaNoWriMo taught me more about finishing things than about writing.',
  E'The first time I tried, I wrote twenty thousand words and stopped. Here is what changed the second time.\n\n- **Write first, edit later.** Editing while drafting kills momentum.\n- **Small daily targets.** 1,667 words a day sounds like a lot until you break it into three sittings.\n- **Tell people.** Accountability is a cheat code.\n\nThe same rules apply to side projects.',
  true, '2026-03-01', '2026-03-01', '2026-03-01'
),
(
  'Unfinished: Draft About Postgres Migrations',
  'This is a draft and should not show on the public site.',
  E'If you can see this on the public Articles page, drafts are leaking.',
  false, '2026-04-01', '2026-04-01', NULL
);

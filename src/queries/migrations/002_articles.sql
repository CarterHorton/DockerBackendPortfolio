-- Long-form articles, written in Markdown.
CREATE TABLE IF NOT EXISTS articles (
  ID SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  cover_image TEXT DEFAULT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_published TIMESTAMP DEFAULT NULL
);

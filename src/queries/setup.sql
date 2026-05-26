CREATE TABLE projects (
  ID INT UNSIGNED NOT NULL AUTO_INCREMENT, 
  title VARCHAR(255) DEFAULT '[Redacted]',
  content MEDIUMTEXT NOT NULL,
  start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_date DATETIME DEFAULT NULL,
  PRIMARY KEY(ID)
);

INSERT INTO projects (title, content)
VALUES ('Portfolio Database', 'Creating this website has been a blast, but I think that it is about time to start creating some data to flood this site with, and put my programming skills to the test. 
This project is to track the progress of creating the database for my website, and for managing it in the future.');

CREATE TABLE journals (
  ID INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED,
  title VARCHAR(255) DEFAULT '[Redacted]',
  content MEDIUMTEXT NOT NULL,
  date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ID),
  FOREIGN KEY (project_id) REFERENCES projects(ID) ON DELETE CASCADE
);

INSERT INTO journals (project_id, title, content)
VALUES (1, 'Raw sql', 'The database is up and running, I have the projects and the journal tables created, but I am typing out sql for inputs...
I guess I need to make an API next. I think that is about all on the database for now.');
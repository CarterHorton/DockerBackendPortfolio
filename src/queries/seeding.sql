INSERT INTO projects (title, content)
VALUES ('Portfolio Database', 'Creating this website has been a blast, but I think that it is about time to start creating some data to flood this site with, and put my programming skills to the test. 
This project is to track the progress of creating the database for my website, and for managing it in the future. I want to create dashboard so that I am able to adjust add and delete data.
It is also important to make sure that that data is secured behind levels of security. Super excited to have this go live.');

-- INSERT INTO journals (project_id, title, content)
-- VALUES (1, 'Expressed proggress', 'This project is being created using express.js. I have used express in the past, so after a quick refresher I was able to get some of the API stuff set up.
-- Currently I am making request via the .rest extenstion in VScode, but it is helping me to get an idea of how things work');

-- INSERT INTO journals (project_id, title, content)
-- VALUES (1, 'Authorization', 'I was able to set up some authorization using jsonWebTokens in express. Since I only have one user that needs to access the backend, namely myself, I only made one
-- user and thus did not need a database. I love that I can just call some middleware and have that authenticate the token, rather than manually worry about it at each endpoint.');

-- INSERT INTO journals (project_id, title, content)
-- VALUES (1, 'Front-End Connection', 'I finally was able to get some connection to the frontend. Since I am programming in angular I was able to use a @for loop to iterate over a list of 
-- journal and project entries for the website. So I simply make a call to the backend requesting all of ther journals and pass that in and angular takes care of the rest.');

-- INSERT INTO journals (project_id, title, content)
-- VALUES (1, 'Insert Into', 'Next up was creating some connections to allow me to post, get, patch, and delete. For this I had to make a whole new page and a service I called ApiHandler. Angular has 
-- a really cool thing where you can define a service, then call its functions and interfaces from another file. I guess I shouldn\'t be that impressed, but it did save me so much 
-- pain to be able to handle all of my backend connections in one place.');

-- INSERT INTO journals (project_id, title, content)
-- VALUES (1, 'Authorization (Cookies)', 'This was the biggest pain that I had yet for this project. First of all I needed to get the ngx-cookie-service to be able to use cookies within my angular 
-- application. This required me to do the worst part of my job: updating software. My angular version was not compatible with the version of cookie-service that I wanted to use. But an hour 
-- later and I was able to get the cookie package installed via npm. After that it was super intuitive to set up the cookies to automatically pass and store the tokens within system memory');

-- INSERT INTO journals (project_id, title, content)
-- VALUES (1, 'CRUD', 'With the login page done, and the dashboard limited to only those with a valid cookie everything is starting to come together. I did some testing and sure enough 
-- all the endpoints and buttons work how intended. I am truelly disapointed none of you who read this will never see what I made on the backend (not legally at least). But as I 
-- write this I realize I have, as a sophmore in college who has never taken a database class, created a create read update delete (CRUD) webapp entirely on my own.');
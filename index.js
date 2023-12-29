import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import LocalStrategy from "passport-local";
import "dotenv/config";

// variables
const app = express();
const port = 3000;

// db setup
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
db.connect();

// middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// passport setup
passport.use(
  new LocalStrategy(async function verify(username, password, cb) {
    let user;
    try {
      const response = await db.query("SELECT * FROM admin_user WHERE username = $1", [
        username,
      ]);
      if (response.rows.length > 0) {
        user = response.rows[0];

        bcrypt.compare(password, user.password, (err, result) => {
          if (err) return cb(err);
          if (!result)
            return cb(null, false, { message: "Incorrect username or password." });

          return cb(null, user);
        });
      } else return cb(null, false, { message: "Incorrect username or password." });
    } catch (err) {
      return cb(err);
    }
  })
);
passport.serializeUser((user, cb) => {
  process.nextTick(() => {
    return cb(null, {
      id: user.id,
      username: user.username,
    });
  });
});
passport.deserializeUser((user, cb) => {
  process.nextTick(() => cb(null, user));
});

// helper functions
async function getAllBooks() {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY id DESC");
    return result.rows;
  } catch (error) {
    console.error("Error getting all books", error);
    throw error;
  }
}

async function filterBooks(filter) {
  try {
    let result;
    if (filter === "id") result = await db.query("SELECT * FROM books ORDER BY id DESC");
    else if (filter === "title")
      result = await db.query("SELECT * FROM books ORDER BY title ASC");
    else if (filter === "rating")
      result = await db.query("SELECT * FROM books ORDER BY rating DESC");

    return result.rows;
  } catch (error) {
    console.error("Error filtering books", error);
    throw error;
  }
}

async function getBook(id) {
  try {
    const result = await db.query(
      "SELECT id, title, author, rating, date_read, isbn, description \
    FROM books WHERE id = $1",
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error getting book.", error);
    throw error;
  }
}

async function getAllNotes(id) {
  try {
    const result = await db.query("SELECT note FROM booknotes WHERE book_id = $1", [id]);
    return result.rows;
  } catch (error) {
    console.error("Error getting all notes.", error);
    throw error;
  }
}

// endpoints
// home page
app.get("/", async (req, res) => {
  try {
    res.render("index", {
      isDaks: req.isAuthenticated(),
    });
  } catch (error) {
    console.error("Error rendering home page", error);
    res.status(500).send("Internal Server Error");
  }
});

// all books
app.get("/books/", async (req, res) => {
  try {
    const books = await getAllBooks();

    res.render("book", {
      books: books,
      isDaks: req.isAuthenticated(),
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.post("/books/", async (req, res) => {
  const rating = parseFloat(req.body.rating);
  try {
    await db.query(
      "INSERT INTO books (title, author, rating, date_read, description, isbn) \
      VALUES ($1, $2, $3, $4, $5, $6)",
      [
        req.body.title,
        req.body.author,
        rating,
        req.body.date,
        req.body.description,
        req.body.isbn,
      ]
    );

    res.redirect("/books");
  } catch (err) {
    console.log("Can't add book.", err);
    res.status(500).send("Internal Server error.");
  }
});

// filters
app.post("/books/filter/", async (req, res) => {
  try {
    let filter;
    if (req.body.newest) filter = "id";
    else if (req.body.title) filter = "title";
    else if (req.body.rating) filter = "rating";

    const books = await filterBooks(filter);

    res.render("book", {
      books: books,
      isDaks: req.isAuthenticated(),
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// notes for each book
app.get("/books/:id/", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const book = await getBook(id);
    const notes = await getAllNotes(id);

    res.render("notes", {
      book: book,
      notes: notes,
      isDaks: req.isAuthenticated(),
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.post("/books/:id/", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.query("INSERT INTO booknotes (book_id, note) VALUES ($1, $2)", [
      id,
      req.body.note,
    ]);

    res.redirect(`/books/${id}`);
  } catch (err) {
    console.error("Can't save note", err);
    res.status(500).send("Internal Server error.");
  }
});

/* admin user setup */
app.get("/admin/register/", (req, res) => {
  try {
    res.render("register");
  } catch (err) {
    console.error("Can't render register.", err);
    res.status(500).send("Internal server error.");
  }
});

app.post("/admin/register/", async (req, res) => {
  if (req.body.password === req.body.password2) {
    try {
      const result = await db.query("SELECT * FROM admin_user");
      if (result.rows.length === 0) {
        bcrypt.hash(
          req.body.password,
          parseInt(process.env.SALTROUNDS),
          async (err, hash) => {
            await db.query(
              "INSERT INTO admin_user (id, username, password) VALUES ($1, $2, $3)",
              [1, req.body.username, hash]
            );

            if (err) {
              console.error("Can't save password.", err);
              res.redirect("/admin/register");
            }
          }
        );
        res.redirect("/admin/login");
      } else res.redirect("/");
    } catch (err) {
      console.error("Internal server error", err);
      res.redirect("/admin/register");
    }
  } else res.redirect("/admin/register");
});

app.get("/admin/login/", (req, res) => {
  try {
    res.render("login");
  } catch (err) {
    console.error("Can't render login.", err);
    res.status(500).send("Internal Server error.");
  }
});

app.post(
  "/admin/login/",
  passport.authenticate("local", { failureRedirect: "/admin/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/admin/logout/", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

app.listen(port, () => {
  console.log(`Sever is running on port ${port}.`);
});

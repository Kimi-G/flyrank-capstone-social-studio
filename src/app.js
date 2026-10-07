const express = require("express");

const postsRouter =
  require("./routes/posts.routes");

const variantsRouter =
  require("./routes/variants.routes");  

  const schedulesRouter =
  require("./routes/schedules.routes");

// Importing the database initializes
// the schema before requests arrive.
require("./db/db");

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

app.use(express.json({
  limit: "1mb"
}));

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok"
  });
});

app.use("/posts", postsRouter);

app.use(
  "/variants",
  variantsRouter
);

app.use(
  "/schedules",
  schedulesRouter
);

app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found"
  });
});

app.listen(PORT, () => {
  console.log(
    `Social Media Studio API running at http://localhost:${PORT}`
  );
});
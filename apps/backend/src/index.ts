import "./env"; // must be the first import
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { HttpError } from "./httpError";
import { demoUser } from "./middleware/demoUser";
import meRoutes from "./routes/me";
import dayRoutes from "./routes/days";
import taskRoutes from "./routes/tasks";
import storeRoutes from "./routes/store";
import noteRoutes from "./routes/notes";
import scheduleRoutes from "./routes/schedule";
import bucketRoutes from "./routes/bucket";

const app = express();

// Allow the frontend (a different URL) to call this API
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? "http://localhost:3000" }));
// Read JSON request bodies into req.body
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Everything below needs a user
app.use(demoUser);
app.use("/me", meRoutes);
app.use("/days", dayRoutes);
app.use("/tasks", taskRoutes);
app.use("/store", storeRoutes);
app.use("/notes", noteRoutes);
app.use("/schedule", scheduleRoutes);
app.use("/bucket", bucketRoutes);

// Any error thrown in a route ends up here
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  const message = (error as { message?: string })?.message ?? "Something went wrong";
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

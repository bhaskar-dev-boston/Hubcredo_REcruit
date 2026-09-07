import "dotenv/config";
import express from "express";
import cors from "cors";
import recruitRouter from "./routes/recruit";
import replyioRouter from "./routes/replyio";
import replyioLinkedinRouter from "./routes/replyioLinkedin";
import integrationsManualRouter from "./routes/integrationsManual";
import inboxkitRouter from "./routes/inboxkit";
import healthRouter from "./routes/health";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", recruitRouter);
app.use("/api", replyioRouter);
app.use("/api", replyioLinkedinRouter);
app.use("/api", integrationsManualRouter);
app.use("/api", inboxkitRouter);
app.use("/api", healthRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend on :${PORT}`));
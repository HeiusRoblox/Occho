import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import loginRouter from "./login.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(loginRouter);
router.use(adminRouter);

export default router;

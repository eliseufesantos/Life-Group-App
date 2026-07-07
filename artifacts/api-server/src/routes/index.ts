import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import membersRouter from "./members";
import discipleshipRouter from "./discipleship";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(membersRouter);
router.use(discipleshipRouter);

export default router;

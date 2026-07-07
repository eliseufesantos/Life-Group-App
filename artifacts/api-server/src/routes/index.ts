import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import membersRouter from "./members";
import discipleshipRouter from "./discipleship";
import calendarRouter from "./calendar";
import boardRouter from "./board";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(membersRouter);
router.use(discipleshipRouter);
router.use(calendarRouter);
router.use(boardRouter);
router.use(storageRouter);

export default router;

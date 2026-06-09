import { Router } from "express";
import {
  registerUniAdmin,
  requestOtp,
  registerCanteenAdmin,
  loginUniAdmin,
} from "../controllers/universityAdmin.controllers.js";
import { verifyJWT } from "../middlewares/verifyJWT.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { registerStudent, uploadStudents } from "../controllers/student.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
const router = Router();

router.route("/register/admin").post(requestOtp);
router.route("/verify/admin").post(registerUniAdmin);
router.route("/login/admin").post(loginUniAdmin);
// Secured Routes
router
  .route("/register/canteen-admin")
  .post(verifyJWT, authorizeRole("University Admin"), registerCanteenAdmin);

router
  .route("/students/upload")
  .post(verifyJWT, authorizeRole("University Admin"), upload.single("file"), uploadStudents);

router.route("/register/student").post(registerStudent);
export default router;

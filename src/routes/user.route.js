import { Router } from "express";
import {
  registerUniAdmin,
  requestOtp,
  registerCanteenAdmin,
  loginUniAdmin,
} from "../controllers/universityAdmin.controllers.js";
import { verifyJWT } from "../middlewares/verifyJWT.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import {
  registerStudent,
  uploadStudents,
  loginStudent,
  getProducts,
  orderFood,
} from "../controllers/student.controllers.js";
import { uploadCsv, uploadImage } from "../middlewares/multer.middleware.js";
import {
  getOrders,
  listProduct,
  loginCanteenAdmin,
  updateStatus,
} from "../controllers/canteenAdmin.cotrollers.js";
import { CanteenAdmin, UniversityAdmin } from "../models/user.model.js";
import { logoutUser } from "../controllers/logout.controllers.js";
import { Student } from "../models/student.model.js";

const router = Router();
// University Admin
router.route("/admin/register").post(requestOtp);
router.route("/admin/verify").post(registerUniAdmin);
router.route("/admin/login").post(loginUniAdmin);

// Secured Routes
// University Admin Upload Canteen Admin Credentials
router
  .route("/register/canteen-admin")
  .post(verifyJWT(UniversityAdmin), authorizeRole("University Admin"), registerCanteenAdmin);

// University Admin Upload Students Data
router
  .route("/students/upload")
  .post(
    verifyJWT(UniversityAdmin),
    authorizeRole("University Admin"),
    uploadCsv.single("csvFile"),
    uploadStudents
  );
// Student Registration & Login
router.route("/student/register").post(registerStudent);
router.route("/student/login").post(loginStudent);

// Canteen Admin
router.route("/canteenAdmin/login").post(loginCanteenAdmin);
router
  .route("/canteenAdmin/upload/product")
  .post(verifyJWT(CanteenAdmin), uploadImage.single("image"), listProduct);

// Log Out Routes
router.route("/admin/logout").post(verifyJWT(UniversityAdmin), logoutUser(UniversityAdmin));
router.route("/student/logout").post(verifyJWT(Student), logoutUser(Student));
router.route("/canteenAdmin/logout").post(verifyJWT(CanteenAdmin), logoutUser(CanteenAdmin));

// Food Fetch and Order
router.route("/products").post(verifyJWT(Student), getProducts);
router.route("/order").post(verifyJWT(Student), orderFood);

// Canteen Admin Fetche all Orders
router.route("/getOrders").post(verifyJWT(CanteenAdmin), getOrders);
router.route("/orders/:orderId/status").patch(verifyJWT(CanteenAdmin), updateStatus);
export default router;

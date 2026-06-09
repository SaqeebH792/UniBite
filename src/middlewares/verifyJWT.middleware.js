import { UniversityAdmin } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import jwt from "jsonwebtoken";

const verifyJWT = async function (req, _, next) {
  try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new apiError(400, "Unauthorized Request");
    }
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // Get user Data from decoded Token

    const user = await UniversityAdmin.findById(decodedToken._id);
    if (!user) {
      throw new apiError(401, "Invalid Token");
    }

    req.user = user;
    return next();
  } catch (error) {
    return next();
  }
};

export { verifyJWT };

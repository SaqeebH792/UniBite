import { apiError } from "../utils/apiError.js";
import jwt from "jsonwebtoken";

const verifyJWT = Model => {
  return async function (req, _, next) {
    try {
      const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        throw new apiError(401, "Unauthorized Request");
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const user = await Model.findById(decodedToken._id).select("-password");

      if (!user) {
        throw new apiError(401, "Invalid Token or User not found");
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      if (error.name === "TokenExpiredError") {
        return next(new apiError(401, "Token Expired"));
      }
      return next(new apiError(401, error.message || "Invalid Token"));
    }
  };
};

export { verifyJWT };

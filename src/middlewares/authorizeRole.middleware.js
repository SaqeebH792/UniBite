import { apiError } from "../utils/apiError.js";

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new apiError(401, "Unauthorized");
    }
    if (!roles.includes(req.user.role)) {
      throw new apiError(403, "Access Denied");
    }
    next();
  };
};
export { authorizeRole };

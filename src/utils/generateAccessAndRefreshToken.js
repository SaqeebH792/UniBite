import { apiError } from "./apiError.js";
// Generate Access and Refresh Token
const generateAccessAndRefreshToken = async function (collection, userId) {
  try {
    const user = await collection.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refresToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.log(error);
    throw new apiError(500, "Something went wrong");
  }
};

export { generateAccessAndRefreshToken };

import { apiResponse } from "../utils/apiResponse.js";
import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const logoutUser = Model =>
  asyncHandler(async (req, res) => {
    console.log(req.user);
    if (!req.user) {
      throw new apiError(401, "Unauthorized Request");
    }

    await Model.findByIdAndUpdate(
      req.user._id,
      {
        $unset: {
          refreshToken: 1,
        },
      },
      {
        new: true,
      }
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new apiResponse(200, {}, "Logged Out Successfully"));
  });

export { logoutUser };

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const authPlugin = (schema, options = {}) => {
  // Pre-save hook for password hashing
  schema.pre("save", async function (next) {
    try {
      if (!this.isModified("password")) return next();

      this.password = await bcrypt.hash(this.password, 10);
      return next();
    } catch (error) {
      return;
    }
  });

  // Method to check password validity
  schema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
  };

  // Method to generate Access Token dynamically
  schema.methods.generateAccessToken = function () {
    const payload = { _id: this._id };

    // Dynamically add fields specified in the options
    if (options.tokenFields && Array.isArray(options.tokenFields)) {
      options.tokenFields.forEach(field => {
        if (this[field] !== undefined) {
          payload[field] = this[field];
        }
      });
    }

    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    });
  };

  // 4. Method to generate Refresh Token
  schema.methods.generateRefreshToken = function () {
    return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    });
  };
};

export { authPlugin };

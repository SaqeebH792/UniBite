import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
const connectDB = async function () {
  try {
    const connectionInstance = await mongoose.connect(`${process.env.DATABASE_URI}/${DB_NAME}`);
    console.log("Database Connected Successfully! Hosted at: ", connectionInstance.connection.host);
  } catch (error) {
    console.log("Database Connection Error: ", error);
  }
};
export { connectDB };

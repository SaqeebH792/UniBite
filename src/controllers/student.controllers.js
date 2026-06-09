import { Student, UploadedStudent } from "../models/student.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import fs from "fs";
import csv from "csv-parser";
import { Readable } from "stream";

const uploadStudents = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new apiError(400, "File is Required");
  }
  console.log(req.user);
  const students = [];

  const dataStream = Readable.from(req.file.buffer);

  await new Promise((resolve, reject) => {
    dataStream
      .pipe(csv())
      .on("data", row => {
        if (!row.fullName || !row.registrationNo || !row.email || !row.cnic || !row.session) {
          return;
        }

        students.push({
          fullName: row.fullName.trim(),
          registrationNo: row.registrationNo.trim().toLowerCase(),
          email: row.email.trim(),
          cnic: row.cnic.trim(),
          session: row.session,
          universityId: req.user._id,
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  if (!students.length) {
    throw new apiError(400, "CSV File is Empty");
  }

  console.log("students: ", students);
  const existingStudents = await Student.find({
    universityId: req.user.universityId,
    registrationNo: {
      $in: students.map(student => student.registrationNo),
    },
  });

  const existingRegistrationNos = new Set(existingStudents.map(student => student.registrationNo));

  const newStudents = students.filter(
    student => !existingRegistrationNos.has(student.registrationNo)
  );

  await UploadedStudent.insertMany(newStudents);

  return res.status(201).json(
    new apiResponse(
      201,
      {
        uploaded: newStudents.length,
        skipped: students.length - newStudents.length,
      },
      "Students uploaded successfully"
    )
  );
});

// ---------------------------------- Register Student -------------------------------------------------
const registerStudent = asyncHandler(async (req, res, next) => {
  const { registrationNo, cnic, email, password } = req.body;

  if (!registrationNo || !cnic || !email || !password) {
    throw new apiError(400, "All fields are Required");
  }
  // Check if Student is already Register
  const existingStudent = await Student.findOne({ registrationNo, cnic });
  if (existingStudent) {
    throw new apiError(400, "User already Registered");
  }
  // Validate the Student Registration No
  const studentRecord = await UploadedStudent.findOne({ registrationNo, cnic });
  if (!studentRecord) {
    throw new apiError("Invalid Registration No");
  }
  const session = studentRecord.session;
  console.log(typeof session);
  const endYear = "20" + session.split("-")[1];

  const currentYear = new Date().getFullYear();

  if (currentYear > endYear) {
    throw new apiError(400, "Cannot Create Account! Session End");
  }
  const status = await studentRecord.isActive;
  console.log(studentRecord);
  console.log(status);
  if (status !== true) {
    throw new apiError(400, "Cannot Create Account! Session Expired");
  }
  // Save student data
  const student = await Student.create({
    registrationNo,
    cnic,
    email,
    password,
    universityId: studentRecord.universityId,
    isActive: true,
    isRegistered: true,
    session: session,
  });

  const createdStudet = await Student.findById(student._id).select("-password");

  res.status(201).json(new apiResponse(201, createdStudet, "Registration Successful"));
});
export { uploadStudents, registerStudent };

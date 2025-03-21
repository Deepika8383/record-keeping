const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const aws = require("aws-sdk");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const router = express.Router();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// MongoDB Schema
const patientSchema = new mongoose.Schema({
  userId: String,
  password: String,
  prescriptions: [{ type: String }], // S3 URLs
  reports: [{ type: String }],       // S3 URLs
});

const Patient = mongoose.model("Patient", patientSchema);

// AWS S3 Setup
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

// File Upload Middleware
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Register/Login Endpoint
router.get('/',(req, res)=>{
    return res.json({
        message: "API is up and running"
    })
})
router.post("/auth", async (req, res) => {
  const { userId, password } = req.body;
  let patient = await Patient.findOne({ userId });

  if (!patient) {
    const hashedPassword = await bcrypt.hash(password, 10);
    patient = new Patient({ userId, password: hashedPassword, prescriptions: [], reports: [] });
    await patient.save();
    return res.json({ message: "User registered", patient });
  }

  const isMatch = await bcrypt.compare(password, patient.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  res.json({ message: "Login successful", patient });
});

// Upload Prescription/Report
router.post("/upload", upload.single("file"), async (req, res) => {
  const { userId, type } = req.body; // type: "prescription" or "report"
  console.log(userId)
  const patient = await Patient.findOne({ userId });

  if (!patient) return res.status(404).json({ message: "User not found" });

  console.log("File received:", req.file);
  const fileParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `records/${userId}/${Date.now()}-${req.file.originalname}`,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  try {
    const uploadResult = await s3.upload(fileParams).promise();
    patient[type].push(uploadResult.Location);
    await patient.save();

    res.json({ message: "File uploaded", url: uploadResult.Location });
  } catch (error) {
    res.status(500).json({ message: "S3 Upload Error", error });
  }
});

// Fetch Records
router.get("/records/:userId", async (req, res) => {
  const patient = await Patient.findOne({ userId: req.params.userId });
  if (!patient) return res.status(404).json({ message: "User not found" });

  res.json({ prescriptions: patient.prescriptions, reports: patient.reports });
});

module.exports = router;

